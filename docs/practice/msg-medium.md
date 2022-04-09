An inter-bank transfer is a typical distributed transaction scenario, where A needs to transfer money across a bank to B. The balances of A and B are not in the same bank so that they are not stored in a single database. This transfer is typically crossing micro-services also.

The main problem is that the transfer must update two systems simultaneously -- the increment of A' balance and the decrement of B's balance. This is called well-known "dual writes". A process crash between the two updates leaves the entire system in an inconsistent state.

This "dual writes" problem can be solved by OutBox pattern. The principal of OutBox pattern can be found here [Transactional OutBox](https://microservices.io/patterns/data/transactional-outbox.html)

## 2-Phase Message

This article proposes an alternative pattern to SendBox: 2-phase message. It is not based on message queue, but based on [github.com/dtm-labs/dtm](https://github.com/dtm-labs/dtm), a highly available distributed transaction framework.

First let's take a glance at how to accomplish the above transfer task using the new pattern. The following codes is in Go, other languanges like C#, PHP can be found here: [dtm SDKs](https://en.dtm.pub/ref/sdk.html)

``` Go
msg := dtmcli.NewMsg(DtmServer, gid).
	Add(busi.Busi+"/TransIn", &TransReq{Amount: 30})
err := msg.DoAndSubmitDB(busi.Busi+"/QueryPreparedB", db, func(tx *sql.Tx) error {
	return AdjustBalance(tx, busi.TransOutUID, -req.Amount)
})
```

In this part of the code
- First new a DTM `msg` global transaction, passing the dtm server address and the global transaction id
- Add to the msg a branch business, which is the transfer operation TransIn, together with the data that needs to be passed to this service, the amount of 30$
- Then call msg's DoAndSubmitDB, this function will ensure the atomicy execution of the business and submittion of `msg` global transactions, either both succeeded, or both failed. This function has three parameters:
	1. The checkback URL, will be explained later
	2. DB, is database object for the business
	3. The business function, here in our example is to debit 30$ for A's balance

What will happen when there is a process crash after the success of decrement of A's balance? After a transaction timeout, DTM will call the checkback URL to query whether the decrement is successful or unsuccessful. We can accomplish the checkback service by pasting the following code:

``` Go
	app.GET(BusiAPI+"/QueryPreparedB", dtmutil.WrapHandler2(func(c *gin.Context) interface{} {
		return MustBarrierFromGin(c).QueryPrepared(db)
	}))
```

After writing these two pieces of codes, a 2-phase message is accomplished, much simpler than OutBox.

## Run It
You can run the above example by the following instruction.

#### Run DTM
``` bash
git clone https://github.com/dtm-labs/dtm && cd dtm
go run main.go
```

#### Run Example
``` bash
git clone https://github.com/dtm-labs/dtm-examples && cd dtm-examples
go run main.go http_msg_doAndCommit
```

## Successful Process
How does DoAndSubmitDB ensure the atomicity of successful business execution and msg submission? Please see the following timing diagram.

![msg_normal](../imgs/msg_normal.svg)

In general, the 5 steps in the timing diagram will complete normally, the whole business proceeds as expected, than the global transaction completes. There is something needed to explain here: the commit of msg is initiated in two phases, first Prepare, then Submit. After DTM receives the Prepare call, it does not call the branch transaction, but waits for the subsequent Submit. Only when it receives the Submit, it starts the branch call and finally completes the global transaction.

## Crash After Commit {#query}
In a distributed system, all kinds of downtime and network exceptions need to be considered, so let's take a look at what can happen.

The most important goal we want to achieve is that both the business execution and the message submission compose an atomic operation. So let's first look at what happens if there is a downtime failure after the business execution and before the message submission, and how the new pattern ensures atomicity.

Let's take a look at the timing diagram in this case.

![msg_query](../imgs/msg_query.svg)

What happens if the process crashes or the machine goes down after the local transaction is committed and before the Submit is sent? In this case, DTM will poll the messages that is only Prepared but not Submitted after a certain timeout and call the checkback service specified by the message.

This checkback service goes inside the table and queries whether the local transaction for business has committed.
- **Committed:** Returns success, dtm proceeds to the next subtransaction call
- **Rolled back:** Failure is returned, dtm terminates the global transaction and no more subtransaction calls are made
- **In progress:** This checkback will wait for the final result and then process as the previous committed/rollbacked case
- **Not Started:** This checkback will insert data to ensure that the local transaction for business eventually fails

## Crash Before Commit
Let's take a look at the timing diagram of a local transaction being rolled back.
![msg_rollback](../imgs/msg_rollback.svg)

If the process is crashed before the transaction commitment and after the dtm receives the Prepare call, the database will detect the process's disconnection and rollback the local transaction automatically.

Subsequently, dtm polls for the global transactions that have timed out, only Prepared but not Submitted, and checks back. The checkback service finds that the local transaction has been rollbacked and returns the result to dtm. dtm receives the rollbacked result, marks the global transaction as failed, and ends the global transaction.

## 2-Phase Message VS SendBox

The SendBox pattern can also ensure the eventual consistency of the data. As far as SendBox pattern is used, the work required includes
- Executing the local business logic in the local transaction, inserting the messages into the message table and committing them at last
- Writing polling tasks to take messages from the local message table and send them to the message queue. Instead of periodically  executing sqls to poll, this step may use another technique [Log-based Change Data Capture](https://debezium.io/blog/2018/07/19/advantages-of-log-based-change-data-capture/).
- Consuming messages.

Compared with SendBox, 2-phase message has the following advantages.
- No need to learn or maintain any message queues
- No polling tasks to handle
- No need to consume messages

2-phase message only need DTM, which is much easier to lern or to maintain than message queues. All skills involved are function calls and services calls, which is familiar things to all developers.

- The exposed interfaces of 2-phase messages are completely independent of the queue and are only related to the actual business and service calls, making it more developer-friendly
- 2-phase messages do not have to consider the message stacking and other failures, because 2-phase messages depend only on dtm, and developers can think of dtm as being the same as any other ordinary stateless service in the system, relying only on the storage behind it, Mysql/Redis.
- The message queue is asynchronous, while 2-phase messages support both asynchronous and synchronous, the default is asynchronous, just set msg.WaitResult=true, then you can wait for the downstream service to complete synchronously
- 2-phase messages also support specifying multiple downstream services at the same time

#### Application of 2-phase message
2-phase messages can significantly reduce the difficulty of the eventual consistency solution of messages and have been widely used, here are two typical applications.
- [flash-sale system](../app/flash): this architecture can easily carry tens of thousands of order requests on a single machine, and ensure that the number of inventory deducted and the number of orders are accurately matched
- [cache consistency](../app/cache): this architecture can easily ensure the consistency of DB and cache through 2-phase message, which is much better than queue or subscription binlog solution

Example of using redis, Mongo storage engine in combination with 2-phase messages can be found in [dtm-examples](https://github.com/dtm-labs/dtm-examples)

## Backcheck principle

The checkback service appears in the previous timing diagram, as well as in the interface. This checkback design firstly existed in RocketMQ, and the implementation is left to developers to handle manually. In the 2-phase messages, it is handled automatically by copy-and-paste code. So what is the principle of automatic processing?

To perform a checkback, we first create a separate table in the business database instance where the gid(global transaction id) is stored. Gid is written to this table when the business transaction is processed.

When we check back with gid, if we can find gid in the table, then it means the local transaction has been committed, so we can return to dtm that the local transaction has been committed.

When we check back with gid, if we don't find gid in the table, then it means the local transaction is not committed. There are three possible results:
1. The transaction is still in progress.
2. The transaction has been rolled back.
3. The transaction has not started.

I have searched a lot of information about RocketMQ's checkback, but have not found a valid solution. Most suggestions is that if the gid is not found, then do nothing and wait for the next checkback in next 10 seconds. If the checkback has lasted 2 minutes or longer and still cannot find the gid, then the local transaction is considered rollbacked.

There is a big problem in the following cases.
- In the extreme case, a database failure (such as a process pause or disk jam) may occur, lasting longer than 2 minutes, and finally the data is committed again, then at this time, the data is not consistent, and manual intervention is needed to deal with it
- If a local transaction, has been rollbacked, but the checkback operation, within two minutes, will constantly polling every 10 seconds, causing unnecessary load on the server

This problem is completely solved by dtm's 2-phase message solution. dtm's 2-phase message works as follows.

1. When a local transaction is processed, gid is inserted into the `dtm_barrier.barrier` table with an insert reason of COMMITTED. Table `dtm_barrier.barrier` has a unique index on gid.
2. When checking back, the 2-phase message does not directly query whether gid exists, but instead insert ignore a row with the same gid, together with the reason for ROLLBACKED. At this time, if there is already a record with gid in the table, then the new insert operation will be ignored, otherwise the row will be inserted.
3. Query the records in the table with gid, if the reason of the record is COMMITTED, then the local transaction has been committed; if the reason of the record is ROLLBACKED, then the local transaction has been rolled back or will be rolled back.

So how do 2-phase message distinguish between in-progress and rolled back messages? The trick lies in the data inserted during the checkback. If the database transaction is still in progress at the time of the checkback, then the insert operation will be blocked by the in-progress transaction, because the insert operation will wait for the row lock held by the transaction. If the insert operation returns normally, then the local transaction in the database, which must have ended.

## Common messages
2-phase messages can replace not only OutBox, but also the normal message pattern. If you call Submit directly, then it is similar to the normal message pattern, but provides a more flexible and simple interface.

Suppose an application scenario where there is a button on the interface to participate in an activity that grants permanent access to two eBooks. In this case, the server side of this button can be handled like this again.

``` go
msg := dtmcli.NewMsg(DtmServer, gid).
	Add(busi.Busi+"/AuthBook", &Req{UID: 1, BookID: 5}).
	Add(busi.Busi+"/AuthBook", &Req{UID: 1, BookID: 6})
err := msg.Submit()
```

This approach also provides an asynchronous interface without relying on a message message queue.

## Summary
The 2-phase message proposed in this article has a simple and elegant interface that brings a more elegant pattern than OutBox.

Welcome to visit [github.com/dtm-labs/dtm](https://github.com/dtm-labs/dtm). It is a dedicated project to make distributed transactions in micro-services easier. It support multiple languages, and multiple patterns like 2-phase message, Saga, Tcc and Xa.
