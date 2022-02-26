## 2-phase messages

## Overview
This article proposes a 2-phase messaging that can perfectly replace the existing transactional messaging or local message table architecture. In terms of complexity, convenience, performance, and code volume, the new architecture beats the existing architectural solutions and is a revolutionary architecture in this area.

Here we use interbank transfer as an example to explain this new architecture in detail. The business scenario is described as follows.

We need to transfer $30 from A to B across banks. We first perform a transfer out operation TransOut which may fail, i.e., we perform a deduction of $30 from A. If A fails to deduct due to insufficient balance, then the transfer will directly fail and return an error; if the deduction is successful, then the next transfer operation TransIn will be carried out, because TransIn does not have the problem of insufficient balance, and it can be assumed that the transfer operation will definitely succeed.

## HTTP Access
The core code for the 2-phase message to accomplish the above task is shown below.

``` Go
msg := dtmcli.NewMsg(DtmServer, gid).
	Add(busi.Busi+"/TransIn", &TransReq{Amount: 30})
err := msg.DoAndSubmitDB(busi.Busi+"/QueryPreparedB", db, func(tx *sql.Tx) error {
	return busi.SagaAdjustBalance(tx, busi.TransOutUID, -req.Amount, "SUCCESS")
})
```
::: tip gRPC
The access to gRPC is basically the same as HTTP, so I won't go over it here, if you need, you can refer to the example in [dtm-labs/dtm-examples](https://github.com/dtm-labs/dtm-examples)
:::

In this part of the code
- First generate a DTM msg global transaction, passing the dtm server address and the global transaction id
- Add to the msg a branch business logic, which is the business logic for the balance transfer operation TransIn, together with the data that needs to be passed to this service, the amount of 30$
- Then call msg's DoAndSubmitDB, this function to ensure the atomicy execution of the business and submittion of msg global transactions, either both succeed, or both failed
	1. the first parameter for the checkback URL, will be explained later
	2. DB, is the business access to the database object
	3. the third parameter is the business function, the business in our example is to give A debit 30$ balance

## Success Process
How does DoAndSubmitDB ensure the atomicity of successful business execution and msg submission? Please see the following timing diagram.

![msg_normal](../imgs/msg_normal.svg)

In general, the 5 steps in the timing diagram will complete normally, the whole business proceeds as expected, and the global transaction completes. There is something new to explain here, that is, the commit of msg is initiated in two phases, the first phase calls Prepare, the second phase calls Commit, after DTM receives the Prepare call, it does not call the branch transaction, but waits for the subsequent Submit. only when it receives the Submit, it starts the branch call and finally completes the global transaction.

## Crash after commit {#query}
In a distributed system, all kinds of downtime and network exceptions need to be considered, so let's take a look at what can happen.

The first and most important goal we want to achieve is that the business executes successfully and the msg transaction is an atomic operation, so let's first look at what happens if there is a downtime failure after the business completes the commit and before the Submit message is sent, and how the new architecture ensures atomicity.

Let's take a look at the timing diagram in this case.

![msg_query](../imgs/msg_query.svg)

What happens if the process crashes or the machine goes down after the local transaction is committed and before the Submit is sent? In this case, DTM will take out the msg transaction that is only Prepared but not Submitted after a certain timeout and call the checkback service specified by the msg transaction.

Your checkback service logic does not need to be written manually, just call it with the following code.
``` Go
	app.GET(BusiAPI+"/QueryPreparedB", dtmutil.WrapHandler2(func(c *gin.Context) interface{} {
		return MustBarrierFromGin(c).QueryPrepared(dbGet())
	}))
```

This lookup function goes inside the table and queries whether the local transaction has committed.
- **Committed:** Returns success, dtm proceeds to the next subtransaction call
- **Rolled back:** Failure is returned, dtm terminates the global transaction and no more subtransaction calls are made
- **In progress:** This checkback will wait for the final result and then process as the previous committed/rollbacked case
- **Not Started:** This checkback will insert data to ensure that the local transaction eventually fails

## Pre-commit downtime flow
Let's take a look at the timing diagram of a local transaction being rolled back.
![msg_rollback](../imgs/msg_rollback.svg)

If the AP is down before the transaction is committed after the dtm receives the Prepare call, then the database will detect the AP's disconnection and rollback the local transaction automatically.

Subsequently, dtm polls for the global transactions that have timed out and only Prepare but not Submit, and checks back. The checkback service finds that the local transaction has been rollbacked and returns the result to dtm. dtm receives the rollbacked result, marks the global transaction as failed, and ends the global transaction.

## Ease of use
Using the new architecture to handle consistency issues requires only.
- Define the local business logic and specify the next service to be called.
- Define the QueryPrepared processing service, and just copy and paste the example code.

Then we look at the other scenarios

## 2-phase messages vs. local message tables

The above problem can also use the local message table solution (for details of the solution, refer to [The Seven Most Classic Solutions to Distributed Transactions](https://medium.com/@dongfuye/the-seven-most-classic-solutions-for-distributed-transaction-management-3f915f331e15)) to ensure the eventual consistency of the data. If a local message table is used, the work required includes
- Executing the local business logic in the local transaction, inserting the messages into the message table and committing them last
- Writing polling tasks to take messages from the local message table and send them to the message queue
- consuming messages and sending them to the appropriate processing service

Comparing the two, 2-phase messaging has the following advantages.
- No need to learn or maintain any message queues
- No polling tasks to handle
- No need to consume messages

## 2-phase vs. transactional messaging

The above problem can also be solved using RocketMQ's transactional messaging solution (see [The Seven Most Classic Solutions to Distributed Transactions](https://medium.com/@dongfuye/the-seven-most-classic-solutions-for-distributed-transaction-management-3f915f331e15) for more details on the solution) to ensure the eventual consistency of data. If transactional messaging is used, the work required includes.
- opening a local transaction, sending a half-message, committing the transaction, and sending a commit message
- consume timeout half-messages, query the local database for received timeout half-messages, and then perform Commit/Rollback
- consume the committed message and send the message to the processing service

Comparing the two solutions, 2-phase messaging has the following advantages.
- No need to learn or maintain any message queues
- Complex operations between local transactions and sending messages need to be handled manually and can be buggy if not careful, while 2-phase messaging is fully automated
- No need to consume messages

2-phase messages are similar to RocketMQ's transaction messages in terms of 2-phase commit, and are a new architecture inspired by RocketMQ's transaction messages. The naming of 2-phase messages, instead of reusing RocketMQ's transaction messages, is mainly due to the fact that 2-phase messages are a significant architectural change, while on the other hand, using the name "transaction messages" in the context of distributed transactions can be confusing.

## More Benefits
2-phase messages have many additional advantages over the queueing scheme described earlier.
- The entire exposed interface of 2-phase messages is completely independent of the queue and is only related to the actual business and service calls, making it more developer-friendly
- 2-phase messages do not have to consider the message stacking and other failures, because 2-phase messages depend only on dtm, and developers can think of dtm as being the same as any other ordinary stateless service in the system, relying only on the storage behind it, Mysql/Redis.
- The message queue is asynchronous, while 2-phase messages support both asynchronous and synchronous, the default is asynchronous, just set msg.WaitResult=true, then you can wait for the downstream service to complete synchronously
- 2-phase messages also support specifying multiple downstream services at the same time

::: tip
For more information about synchronous mode, please refer to [transaction options](../ref/options) for waiting the result of a transaction
:::

#### Application of 2-phase messaging
2-phase messages can significantly reduce the difficulty of the eventual consistency solution of messages and have been widely used, here are two typical applications.
- [flash-sale system](../app/flash): this architecture can easily carry tens of thousands of order requests on a single machine, and ensure that the number of inventory deducted and the number of orders are accurately matched
- [cache consistency](../app/cache): this architecture can easily ensure the consistency of DB and cache through 2-phase messaging, which is much better than queue or subscription binlog solution

Example of using redis, Mongo storage engine in combination with 2-phase messages can be found in [dtm-examples](https://github.com/dtm-labs/dtm-examples)

## Backcheck principle dissection
The checkback service appears in the previous timing diagram, as well as in the interface. In the 2-phase messages, it is handled automatically by copy-and-paste code, while in RocketMQ's transaction messages, it is handled manually. So what is the principle of automatic processing?

To perform a checkback, we first create a separate table in the business database instance where the gid(global transaction id) is stored. gid is written to this table when the business transaction is processed.

When we check back with gid, if we can find gid in the table, then it means the local transaction has been committed, so we can return to dtm that the local transaction has been committed.

When we check back with gid, if we don't find gid in the table, then it means the local transaction is not committed, and there are two possible results, one is that the transaction is still in progress, and the other is that the transaction has been rolled back. I have searched a lot of information about RocketMQ, but have not found a valid solution. Most suggestion is that if the result is not committed, then do nothing and wait for the next checkback. If the checkback is 2 minutes or longer and has been unchecked, then the local transaction is considered rollbacked.

There is a big problem with this scenario above.
- In the extreme case, a database failure (such as a process or disk jam) may occur, lasting longer than 2 minutes, and finally the data is committed again, then at this time, the data is not consistent, and manual intervention is needed to deal with it
- If a local transaction, has been rollbacked, but the checkback operation, within two minutes, will constantly polling every second, causing unnecessary load on the server

This problem is completely solved by dtm's 2-phase messaging solution. dtm's 2-phase messaging process works as follows.

1. when a local transaction is processed, gid is inserted into the dtm_barrier.barrier table with an insert reason of COMMITTED. the table has a unique index on gid.
2. when checking back, the operation of the 2-phase message does not directly check whether gid exists, but instead insert ignore a row with the same gid, together with the reason for ROLLBACKED. At this time, if there is already a record with gid in the table, then the new insert operation will be ignored, otherwise the row will be inserted.
3. then query the records in the table with gid, if the reason of the record is COMMITTED, then the local transaction has been committed; if the reason of the record is ROLLBACKED, then the local transaction has been rolled back.

So how do 2-phase messaging distinguish between in-progress and rolled back messages? The trick lies in the data inserted during the checkback. If the database transaction is still in progress at the time of the checkback, then the insert operation will be blocked by the in-progress transaction, because the insert operation will wait for the row lock held by the transaction. If the insert operation returns normally, then the local transaction in the database, which must have ended.

## Common messages
2-phase messages can replace not only the local message table scheme, but also the normal message scheme. If you call Submit directly, then it is similar to the normal message scheme, but provides a more flexible and simple interface.

Suppose an application scenario where there is a button on the interface to participate in an event that grants permanent access to two eBooks. In this case, the server side of this button can be handled like this again.

``` go
msg := dtmcli.NewMsg(DtmServer, gid).
	Add(busi.Busi+"/AuthBook", &Req{UID: 1, BookID: 5}).
	Add(busi.Busi+"/AuthBook", &Req{UID: 1, BookID: 6})
err := msg.Submit()
```

This approach also provides an asynchronous interface without relying on a messaging message queue. In many scenarios of microservices, it can replace the original asynchronous messaging architecture.

## Summary
The two-stage messaging proposed in this article has a simple and elegant interface that brings a more elegant architecture than local message tables and Rocket transaction messages, and can help you better solve this type of data consistency problem without rollback.
