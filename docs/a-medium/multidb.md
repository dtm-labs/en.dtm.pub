# How to Implement Distributed transactions across Mysql, Redis, Mongo
Mysql, Redis and Mongo are all very popular stores, and each has its own advantages. In practical applications, it is common to use multiple stores at the same time and ensuring data consistency across multiple stores becomes a requirement.

This article gives an example of implementing a distributed transaction across multiple store engines, Mysql, Redis and Mongo. This example is based on the Distributed Transaction Framework [https://github.com/dtm-labs/dtm](https://github.com/dtm-labs/dtm) and will hopefully help to solve your problems in data consistency across microservices.

The ability to flexibly combine multiple storage engines to form a distributed transaction is firstly proposed by DTM, and no other distributed transaction framework has stated the ability like this.

## Problem scenarios
Let's look at the problem scenario first. Suppose that a user now participates in an promotion: he or she have a balance, recharge the phone bill, and the promotion will give away mall points. The balance is stored in Mysql, the bill is stored in Redis, the mall points is stored in Mongo. Because the promotion is limited in time, there is a possibility that participation may fail, so rollback support is required.

For the above problem scenario, you can use DTM's Saga transaction, and we will explain the solution in detail below.

## Preparing the Data
The first step is to prepare the data. To make it easier for users to quickly get started with the examples, we have prepared the relevant data at [en.dtm.pub](https://en.dtm.pub), which includes Mysql, Redis and Mongo, and the specific connection username and password can be found at [https://github.com/dtm-labs/dtm-examples](https://github.com/dtm-labs/dtm-examples).

::: tip
If you want to prepare the data environment locally yourself, you can use [https://github.com/dtm-labs/dtm/blob/main/helper/compose.store.yml](https://github.com/dtm-labs/dtm/blob/main/helper/compose.store.yml) to start Mysql, Redis, Mongo; and then execute scripts in [https://github.com/dtm-labs/dtm/tree/main/sqls](https://github.com/dtm-labs/dtm/tree/main/sqls) to prepare the data for this example, where `busi.*` is the business data and `barrier.*` is the auxiliary table used by DTM
:::

## Writing the Business Code
Let's start with the business code for the most familiar Mysql.

::: tip
The following code is in Golang. Other languages such as C#, PHP, Java can be found here: [DTM SDKs](https://en.dtm.pub/ref/sdk.html)
:::

``` go
func SagaAdjustBalance(db dtmcli.DB, uid int, amount int) error {
	_, err := dtmimp.DBExec(db, "update dtm_busi.user_account set balance = balance + ? where user_id = ?" , amount, uid)
	return err
}
```

This code mainly performs the adjustment of the user's balance in the database. In our example, this part of the code is used not only for Saga's forward operation, but also for the compensation operation, where only a negative amount needs to be passed in for compensation.

For Redis and Mongo, the business code is handled similarly, just incrementing or decrementing the corresponding balances.

## How to Ensure Idempotency
For the Saga transaction pattern, when we have a temporary failure in the sub-transaction service, the failed operation will be retried. This failure may occur before or after the sub-transaction commits, so the sub-transaction operation needs to be idempotent.

DTM provides helper tables and helper functions to help users achieve idempotency quickly. For Mysql, it will create an auxiliary table `barrier` in the business database, when the user start a transaction to adjust the balance, it will first insert `Gid` in the `barrier` table. If there is a duplicate row, then the insertion will fail, and then skip the balance adjustment to ensure the idempotent. The code using the helper function is as follows:

``` go
app.POST(BusiAPI+"/SagaBTransIn", dtmutil.WrapHandler2(func(c *gin.Context) interface{} {
	return MustBarrierFromGin(c).Call(txGet(), func(tx *sql.Tx) error {
		return SagaAdjustBalance(tx, TransInUID, reqFrom(c).Amount, reqFrom(c).TransInResult)
	})
}))
```

Mongo handles idempotency in a similar way to Mysql, so I won't go into detail again.

Redis handles idempotency differently than Mysql, mainly because of the difference in the principle of transactions. Redis transactions are mainly ensured by atomic execution of Lua. the DTM helper function will adjust the balance via a Lua script. Before adjusting the balance, it will query `Gid` in Redis. If `Gid` exists, it will skip the balance adjustment; if not, it will record `Gid` and perform the balance adjustment. The code used for the helper function is as follows:
``` go
app.POST(BusiAPI+"/SagaRedisTransOut", dtmutil.WrapHandler2(func(c *gin.Context) interface{} {
	return MustBarrierFromGin(c).RedisCheckAdjustAmount(RedisGet(), GetRedisAccountKey(TransOutUID), -reqFrom(c).Amount, 7*86400)
}))
```

## How to do Compensation
For Saga, we also need to deal with the compensation operation, but the compensation is not simply a reverse adjustment, and there are many pitfalls that should be aware of.

On the one hand, compensation needs to take idempotency into account, because the failure and retries described in previous subsection also exists in compensation. On the other hand, compensation also needs to take "null compensation" into account, since the forward operation of Saga may returns a failure, which may have happened before or after the data adjustment. For failures where the adjustment has been committed we need to perform the reverse adjustment; but for failures where the adjustment has not been committed we need to skip the reverse operation.

In the helper table and helper functions provided by DTM, on the one hand, it will determine whether the compensation is a null compensation based on the Gid inserted by the forward operation, and on the other hand, it will insert Gid+'compensate' again to determine whether the compensation is a duplicate operation. If there is a normal compensation operation, then it will execute the data adjustment on the business; if there is a null compensation or duplicate compensation, it will skip the adjustment on the business.

The Mysql code is as follows.
``` go
app.POST(BusiAPI+"/SagaBTransInCom", dtmutil.WrapHandler2(func(c *gin.Context) interface{} {
	return MustBarrierFromGin(c).Call(txGet(), func(tx *sql.Tx) error {
		return SagaAdjustBalance(tx, TransInUID, -reqFrom(c).Amount, "")
	})
}))
```

The code for Redis is as follows.
``` go
app.POST(BusiAPI+"/SagaRedisTransOutCom", dtmutil.WrapHandler2(func(c *gin.Context) interface{} {
	return MustBarrierFromGin(c).RedisCheckAdjustAmount(RedisGet(), GetRedisAccountKey(TransOutUID), reqFrom(c).Amount, 7*86400)
}))
```

The compensation service code is almost identical to the previous code of the forward operation, except that the amount is multiplied by -1. The DTM helper function automatically handles idempotency and null compensation properly.

## Other exceptions
When writing forward operations and compensation operations, there is actually another exception called "Suspension". A global transaction will roll back when it is timeout or retries has reach the configured limit. The normal case is that the forward operation is performed before the compensation, but in case of process suspension the compensation may be performed before the forward operation. So the forward operation also needs to determine whether the compensation has been executed, and in the case that it has, the data adjustment needs to be skipped as well.

For DTM users, these exceptions have been handled gracefully and properly and you, as a user, need only follow the `MustBarrierFromGin(c).Call` call described above and do not need to care about them at all. The principle for DTM handling these exceptions is described in detail here: [Exceptions and sub-transaction barriers](https://en.dtm.pub/practice/barrier.html)

## Initiating a Distributed Transaction
After writing the individual sub-transaction services, the following codes of the code initiates a Saga global transaction.
``` go
saga := dtmcli.NewSaga(dtmutil.DefaultHTTPServer, dtmcli.MustGenGid(dtmutil.DefaultHTTPServer)).
  Add(busi.Busi+"/SagaBTransOut", busi.Busi+"/SagaBTransOutCom", &busi.TransReq{Amount: 50}).
  Add(busi.Busi+"/SagaMongoTransIn", busi.Busi+"/SagaMongoTransInCom", &busi.TransReq{Amount: 30}).
  Add(busi.Busi+"/SagaRedisTransIn", busi.Busi+"/SagaRedisTransOutIn", &busi.TransReq{Amount: 20})
err := saga.Submit()
```

In this part of the code, a Saga global transaction is created which consists of 3 sub-transactions.
- Transfer out 50 from Mysql
- Transfer in 30 to Mongo
- Transfer in 20 to Redis

Throughout the transaction, if all the sub-transactions complete successfully, then the global transaction succeeds; if one of the sub-transactions returns a business failure, then the global transaction rolls back.

## Run
If you want to run a complete example of the above, the steps are as follows.
1. Run DTM

``` bash
git clone https://github.com/dtm-labs/dtm && cd dtm
go run main.go
```

2. Run a successful example

``` bash
git clone https://github.com/dtm-labs/dtm-examples && cd dtm-examples
go run main.go http_saga_multidb
```

3.  Run a failed example

``` bash
git clone https://github.com/dtm-labs/dtm-examples && cd dtm-examples
go run main.go http_saga_multidb_rollback
```

You can modify the example to simulate various temporary failures, null compensation situations, and various other exceptions where the data is consistent when the entire global transaction is finished.

## Summary
This article gives an example of a distributed transaction across Mysql, Redis and Mongo. It describes in detail the problems that need to be dealt with, and the solutions.

The principles in this article are suitable for all storage engines that support ACID transactions, and you can quickly extend it for other engines such as TiKV.

Welcome to visit [github.com/dtm-labs/dtm](https://github.com/dtm-labs/dtm). It is a dedicated project to make distributed transactions in microservices easier. It supports multiple languages, and multiple patterns like a 2-phase message, Saga, Tcc, and Xa.
