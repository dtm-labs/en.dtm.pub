# Overview
DTM solves the consistency problem of updating data across services and provides a one-stop solution for related problems.

Almost every non-monolithic system, and almost every order system, will have the need to update data across services. Such a need is very widely existed, and is also a challenge brought about by the service/micro-services. In such a situation, the current industry generally believes that distributed transactions are difficult and problematic. In most cases to avoid the use of distributed transaction framework, the business will do their own retries and regularly check data consistency.

DTM solves the problems of distributed transactions, providing a very easy-to-use interface, and the overall solution is much better than the business to solve manually, better than the business to do their own retries, check data consistency, etc.

DTM distributed transaction scenarios are roughly divided into two categories, one does not need to rollback, one needs to rollback. For scenarios that don't require rollback, dtm recommends using 2-phase messages, and for scenarios that require rollback, dtm recommends using saga.

## 2-phase messages
For scenarios that do not require rollback, most of the current industry uses local message tables(also known as outbox patterns) or transaction messages. DTM innovates on the basis of both and proposes 2-phase messages, which have many of the following advantages, without the hard parts.
- Simplify a couple of hundred lines of code in the local message table or transaction messages to less than ten lines
- No need to maintain a polling task or subscription binlog in the local message table
- Automatically handles back-checking in transaction messages, solving the data inconsistency problem of RocketMQ back-checking in extreme cases (patent applied for)
- Provides an API-oriented interface so that users only need to care about API calls and not any message queues
- Provides a semi-synchronous option that allows the caller to wait for the final transaction to complete before returning to the user, improving the user experience

The main function provided is DoAndSubmit, which allows the user to specify their own business processing logic, and then guarantees the "atomicity" of the business processing logic and subsequent API calls (both eventually complete)

## SAGA
For scenarios that require rollback, Seata, a well-known project in the industry, recommends AT mode, while dtm recommends SAGA mode. Personally, I believe that the AT mode promoted by Seata has not been used in a large number of applications for the following reasons.

- The principle is complicated: Although AT mode provides a simple way to use annotations, the principle is very complicated, involving global transaction lock, before image data, writing data lock, etc. It is very difficult to get started.
- Low concurrency: AT and XA both lock the modified data while the transaction is in progress, limiting concurrency. In the scenario where the order system deducts the same inventory item, it is usually only able to one or two dozen orders per second, so this solution is not suitable for high concurrency scenarios.
- Problem-prone: In AT mode, all modification to a data which might be modified in a distributed transaction, must add GlobalLock annotations, otherwise there may be dirty writes which can not be rolled back. Such a constraint is very difficult to ensure in a large team
- Does not support all SQL: AT does not support all SQL, the official documentation has detailed instructions

The SAGA mode of dtm is very simple, users only need to write the forward and compensating operations, and then submit all the transaction branch URLs to dtm, and dtm will do the rest. dtm also has the following advantages.
- dtm also pioneered the subtransaction barrier technology, which solves the idempotent, null-compensation, and suspension problems with a simple function call, greatly reducing the burden on business writers.
- dtm's subtransaction barrier also supports Redis, and mongo, which can combine various multiple data sources into one global transaction.
- dtm supports multiple languages and can combine microservices in multiple languages into one global transaction, which is a very wide use case.

## Other Patterns
dtm also supports other patterns, the use of the following scenarios.
- TCC: If the business has high requirements for consistency and cannot accept the practice of modifying and compensating in SAGA mode, then consider the TCC mode, which can be customized by the business side for data visibility
- XA: If the business does not require high concurrency and there is no hot data contention, then you can use XA mode.

## Typical Application Scenarios
dtm can be used in the following scenarios to solve the related problems elegantly

#### Flash-sale System
Existing flash-sale architectures, in order to support high concurrency, usually put inventory in Redis and perform inventory deduction in Redis when an order request is received. This design results in order creation and inventory deduction not being atomic operations, which can lead to inconsistent data if a process crash or other problem is encountered in between the two operations.

DTM proposes a new flash-sale architecture that completely solves the core pain points in the flash-sale architecture. The architecture can support accurate inventory deduction for over 10,000 orders per second, and ensure that the data of order creation and inventory deduction are strictly consistent in the end. For more information, please see [flash-sale system](./flash)

#### Order System
The vast majority of order systems have been serviced and will be split into order services, inventory services, coupon services, payment services, account services, and so on. Usually an order operation involves: creating an order, deducting inventory, deducting coupons, creating a payment order, etc. If a process crash occurs in the middle of the process, it can lead to inconsistent data between several services.

DTM recommends the above saga approach to solve the order problem, which can ensure the data is strictly consistent in the end. Users only need to write the positive operation and compensate operation of the related services, and then they don't need to worry about the data consistency problem.

For detailed explanation and examples, you can refer to [order system](./order)

#### Cache Consistency
Caching is now a necessary infrastructure in the system to relieve the pressure on the database. But once the cache is introduced, the data is stored in two places, so how can we ensure the consistency of the two? There are already many solutions in the industry, typically relying on message queues or subscribing to database binlogs, which are heavy and require maintenance of message queues or canel, which is a considerable burden.

DTM is committed to solving the consistency problem, so a more lightweight solution based on dtm is also proposed, for details see [cache consistency](./cache)


## Summary
If you are still doing your own retries or manual compensation, then please refer to and try dtm. You will find that dtm will bring you a simple and elegant architectural solution, significantly improve your development efficiency, reduce maintenance costs, and completely change your impression of distributed transactions.