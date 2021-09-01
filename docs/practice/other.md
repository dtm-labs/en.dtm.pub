# Other transaction models

DTM currently implements four common transaction models, namely TCC, SAGA, XA, and Transactional Messaging.
There are other transaction models, which are briefly described below: 

## Local Messaging

The Local Messaging solution was originally published to ACM by ebay architect Dan Pritchett in 2008. 
The key idea is to introduce a persistent message queue to execute tasks that require distributed processing in an asynchronous manner.

The general flow is as follows:

![local_msg_table](../imgs/local_msg_table.jpg)

By queueing a persistent message within the same transaction as the business operation, the atomicity of that business operation and messaging is guaranteed.
They either all complete or they both fail.

Fault tolerance:

- When the balance deduction transaction fails, the transaction is rolled back directly, with no subsequent steps

- When the polling of messages produced or the balance addition transaction fails, it will be retried

Features of Local Messaging:

- Long transactions only need to be split into multiple tasks, which is easy to use

- Producers need to create additional message tables

- Each local message table needs to be polled

- Consumer-side logic requires additional mechanisms to roll back operations if they do not succeed by retrying

Since the Transactional Messaging model is much easier to interface than the Local Messaging model, DTM implements the former model rather than the latter one.

## Best-effort Notification

The initiating notifier notifies the receiver of the result of the business processing with a certain mechanism of best effort.
Specifically:

- Notification of messages can be repeated. 
  Because the receiving side may not receive the notification, there should be some mechanism to repeat the notification of the message.

- Messages can be checked. 
  If the receiver is not notified even after maximum efforts, or if the receiver consumes the message but wants to consume it again, the receiver should be allowed to actively query the message information from the initiating notifier.

What is the difference between the Local Messaging and the Transactional Messaging models introduced earlier, which both produce reliable messages, and the Best-effort Notification model introduced here?

With the former two models, the initiating notifier ensures that the message is sent out and then to the receiving side.
In other words, the reliability of the message is guaranteed by the notifying side.

With the Best-effort Notification model, the initiating notifier does its best to notify the result of the business processing to the receiver, but the message may still not be received.
As a result, the receiving side needs to actively call the initiating notifier's interface to query the result of the business processing, which means that the reliability of the notification relies on the receiving side.

A solution using the Best-effort Notification model should:

- Provide an interface to allow the receiving side to activly query the results of the business processing 

- Setup ACK mechanism of messaging, which means the notification interval is gradually increased with the interval of 1min, 5min, 10min, 30min, 1h, 2h, 5h, 10h, until it reaches the upper limit of the time window of notification requirements. 
  No further notifications are made after that.

Best-effort Notification is applicable to business notification senarios.
For example, the results of WeChat transactions are notified to each merchant through Best-effort Notification model, with both callback notifications and transaction query interfaces.

Best-effort Notification can be considered more of a business design.
In the infrastructure layer, one can use Transaction Messaging directly.

## AT

This is a transaction pattern implemented in the Ali open source project [seata](https://github.com/seata/seata), also known as FMT in Ant Financial Services.

- The advantage of this transaction model is similar to the XA model.
  The business code does not need to provide all kinds of compensation operations, and rollback is done automatically by the framework.

- The Disadvantage is also similar to XA.
  The locking is longer and does not meet the high concurrency scenario.
  The locking is shorter than XA though, thus the performance is a little higher.
  In addition, when using AT mode, dirty rollback may occur.

Please refer to [seata-AT](http://seata.io/zh-cn/docs/dev/mode/xa-mode.html) if you are interested to know more.

DTM does not implement the AT transaction model based on the following considerations:

- Dirty rollbacks need to be handled manually

- To avoid dirty rollbacks, all business personnel accessing the subtransaction tables need to access them through unified annotations, resulting to a high learning curve

- The client side of implementing AT will be very heavy, which is contrary to the original intention of DTM to support cross-language

## Summary

There are a number of popular transaction models, and those implemented in DTM are sufficient for most of the application scenarios
