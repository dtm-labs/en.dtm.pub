# SAGA

SAGA transaction mode is the most commonly used mode in DTM, mainly because it is easy to use, less workload, and can solve most of the business needs.

SAGA first appeared in the paper [SAGAS](https://www.cs.cornell.edu/andru/cs711/2002fa/reading/sagas.pdf) published by Hector Garcaa-Molrna & Kenneth Salem in 1987. The core idea is to split a long transaction into multiple short transactions, coordinated by the Saga transaction coordinator, with the global transaction completing normally if each short transaction completes successfully, and invoking the compensating operations one at a time according to the reverse order if a step fails.

## Split into subtransactions
For example, if we want to perform a transaction similar to an interbank transfer, transferring $30 from A to B. Based on the principle of Saga transactions, we take the entire global transaction and split it into the following services.
- Transfer Out (TransOut) service, here the transfer out will perform operation A - 30
- TransOutCompensate service, which rolls back the above TransOut operation, i.e., A+30
- TransIn service, where the transfer in will be performed B+30
- TransInCompensate service, rolling back the above transfer operation, i.e. B-30

The logic of a successful SAGA transaction is

Execute transfer out successfully => Execute transfer in successfully => Global transaction completion

If an error occurs in the middle, e.g., an error in the TransIn to B, the compensation operation of the executed branch is invoked, i.e.

Execution of TransOut success => Execution of TransIn failure => Execution of TransIn compensation success => Execution of TransOut compensation success => Global transaction rollbacked complete

Here let's see a typical timing diagram of a successfully completed SAGA transaction.

![saga_normal](../imgs/saga_normal.jpg)

In this diagram, our global transaction initiator, after defining the orchestration information of the entire global transaction, including the forward and reverse compensation operations for each step, submits it to the server, which then executes the previous SAGA logic step by step.

## SAGA access

Let's see how to accesses a SAGA transaction

``` go
req := &gin.H{"amount": 30} // load of microservice
// DtmServer is the address of the DTM service
saga := dtmcli.NewSaga(DtmServer, dtmcli.MustGenGid(DtmServer)).
  // Add the sub-transaction of TransOut. The forward action is url: qsBusi+"/TransOut", while the compensating action is url: qsBusi+"/TransOutCompensate"
  Add(qsBusi+"/TransOut", qsBusi+"/TransOutCompensate", req).
  // Add the sub-transaction of TransIn. The forward action is url: qsBusi+"/TransIn", while the compensating action is url: qsBusi+"/TransInCompensate"
  Add(qsBusi+"/TransIn", qsBusi+"/TransInCompensate", req)
// commit saga transaction to DTM, which guarantees all sub-transactions either complete or rollback
err := saga.Submit()
```

The above code first creates a SAGA transaction, and then adds two subtransactions, TransOut and TransIn. Each transaction branch includes two operations, action and compensate, which are the first and second arguments of the Add function. After the subtransaction is finalized, it is submitted to dtm. dtm receives the global transaction submitted by SAGA and calls all the forward operations of the subtransaction, and if all the forward operations complete successfully, the transaction ends successfully.

Refer to [dtm-examples](https://github.com/dtm-labs/dtm-examples) for detailed example code

Our previous example is based on HTTP protocol SDK for DTM access, gRPC protocol access is basically the same, detailed example code can be found in [dtm-examples](https://github.com/dtm-labs/dtm-examples)

## Failure rollback

If there is a forward operation failure, such as account balance is insufficient or account is frozen, then dtm will call the compensation operation of each branch to roll back and finally the transaction is rolled back successfully.

Let's call the second branch above, passing the argument to fail

``` go
  Add(qsBusi+"/TransIn", qsBusi+"/TransInCompensate", &TransReq{Amount: 30, TransInResult: "FAILURE"})
```

The failed timing diagram is as follows.

![saga_rollback](../imgs/saga_rollback.jpg)

::: tip Compensation execution order
If it is a normal SAGA with no concurrency option turned on, then the compensation branch of the SAGA transaction is compensated in exactly the reverse order of the forward branch.

In the case of concurrent SAGA, the compensation branch is also executed concurrently, and the compensation branch is executed in the reverse order of the specified forward branch. If concurrent SAGA specifies that B is executed only after branch A, then when concurrent compensation is performed, DTM ensures that the compensation operation of A is executed after the compensation operation of B
:::

## How to Compensate
When SAGA compensates branch A for failure, the forward operation of A may be 1. executed; 2. not executed; and 3. may even be in execution, and result of execution is unknown. Then it is very difficult to properly handle these three cases when compensating for A.

dtm provides subtransaction barrier technology to handle the above three cases automatically, developers only need to write the compensation operation case for 1, the related work is greatly simplified, for detailed principles, see the exception section below.

## Exceptions

In the transactional domain, exceptions are a key consideration, such as downtime failures and process crashes that can lead to inconsistencies. When we are doing distributed transactions, then exceptions in distribution appear more frequently, and the design and handling of exceptions is even more important.

We divide the exceptions into the following categories.
- **Incidental failure:** In the microservices domain, a tiny percentage of requests fail due to network jitter, machine downtime, and process Crash. The solution to this kind of problem is to retry. After retry, it can be successful, so the microservice framework or gateway class products, will support retry, such as configuration retry 3 times, each interval of 2 s. DTM design is very friendly to retry, will not cause transaction bugs because of retry.
- **Failure Downtime:** Many companies have large number of businesses, and it is common to have one or two business failures in these businesses, DTM also considers this situation and does exponential retreat algorithm in retry, so that if there is a failure downtime, then exponential retreat can prevent a large number of requests from being sent to the failed application to avoid avalanche.
- **Network disorder:** In distributed systems, network latency is unavoidable, so some disorder can occur. For example, in the case of transferring funds, it may happen that the server receives a request to compensate the transfer first, and then receives a transfer request. This kind of problem is a key difficulty in distributed transactions, for details, see [Exception & Solution](../practice/barrier)

Business failures and exceptions need to be strictly distinguished, for example, the previous insufficient balance is a business failure that must be rolled back, and retries are meaningless. Some operations in distributed transactions require eventual success. For example, a compensation operation in SAGA is one that requires eventual success and will keep retrying until it succeeds as long as it hasn't. For a more detailed discussion of this part, see [eventual success](./must-succeed)

By this point in the introduction, you have enough knowledge to develop and complete a common SAGA task. We will now introduce the more advanced knowledge and usage of SAGA
## Advanced Usage

Let's use a real user case to explain the advanced features of the saga part of dtm.

Problem scenario: A user travel application receives a user travel plan and needs to book a ticket to Sanya, a hotel in Sanya, and a return ticket.

Requirements.
1. both tickets and hotels are either booked successfully or both rolled back (the hotel and airline provide the relevant rollback interfaces)
2. the booking of air tickets and hotels is concurrent, to avoid serial cases. The confirmation may take too much time, resulting in ticket sold out in this period.
3. the confirmation time of the booking result may vary from 1 minute to 1 day

These requirements are the areas where the saga transaction pattern excels, so let's see how dtm solves them.

First of all, we create a saga transaction according to requirement 1, this saga contains three branches, respectively, booking a flight to Sanya, booking a hotel, booking a return flight

``` go
		saga := dtmcli.NewSaga(DtmServer, gid).
			Add(Busi+"/BookTicket", Busi+"/BookTicketRevert", bookTicketInfo1).
			Add(Busi+"/BookHotel", Busi+"/BookHotelRevert", bookHotelInfo2).
			Add(Busi+"/BookTicket", Busi+"/BookTicketRevert", bookTicketBackInfo3)
```

Then we make saga execute concurrently according to requirement 2 (which is sequential by default)

``` go
  saga.EnableConcurrent()
```

Finally, we deal with the problem that the "confirmation may take too much time" in 3 is not an immediate response. Since it is not an immediate response, we cannot make the scheduled operation waiting for the third-party result, but return the status in progress as soon as the scheduled request is submitted. Our branch transaction is not completed, dtm will retry our transaction branch, and we specify the retry interval as 1 minute.

``` go
  saga.RetryInterval = 60
  saga.Submit()
func bookTicket() string {
	order := loadOrder()
	if order == nil { // No order has been placed yet, third party order operation is performed
		order = submitTicketOrder()
		order.save()
	}
	order.Query() // query the status of the third-party order
	return order.Status // Success-SUCCESS Failure-FAILURE In progress-ONGOING
}
```

::: Fixed interval retries
By default, the retry strategy of dtm is an exponential retreat algorithm, which can avoid too many retries leading to high load in case of failure. But here the booking result should not be retried using exponential retreat algorithm, otherwise the end user will not be notified in time. Therefore, in bookTicket, the result ONGOING is returned, and when dtm receives this result, it will use fixed interval retry, so that the user can be notified in time.
:::
## More advanced scenarios
In practical applications, we have also met some business scenarios that require some additional skills to handle

#### Some third-party operations cannot be rolled back

For example, if an order is shipped, once the shipping instruction is given, then it is difficult to roll back the operation directly if it involves offline related operations. How do you handle a saga that involves this type of situation?

We divide the operations in a transaction into those that can be rolled back and those that cannot be rolled back. Then put the rollbackable operations in front and the non-rollbackable operations in the back, then we can solve this kind of problem.

``` go
		saga := dtmcli.NewSaga(DtmServer, dtmcli.MustGenGid(DtmServer)).
			Add(Busi+"/CanRollback1", Busi+"/CanRollback1Revert", req).
			Add(Busi+"/CanRollback2", Busi+"/CanRollback2Revert", req).
			Add(Busi+"/UnRollback1", "", req).
			Add(Busi+"/UnRollback2", "", req).
			EnableConcurrent().
			AddBranchOrder(2, []int{0, 1}). // Specify step 2, which needs to be executed after 0 and 1 are completed
			AddBranchOrder(3, []int{0, 1}) // Specify step 3, which needs to be executed after 0, 1 is completed
```

The code in the example, specifying the UnRollback operation in Step 2, 3, must be executed after Step 0, 1 completes.

For non-rollbackable operations, DTM's design recommendation is that non-rollbackable operations are not allowed to return failures in business either. For example, if the shipping operation returns a failure, then what todo? Retry will always return failure, and rollback is not supported.

In addition, if there are two operations that are not rollbackable and may return failure in a global transaction, it may happen that one execution succeed, and one execution failed. In this case the execution of the successful one can not be rolled back, then inconsistency happened.

For the shipping operation, if the failure may occur on the data verification, then the shipping operation will be split into two services: shipment verification and shipment, and shipment verification can be rolled back, and shipment cannot be rolled back and will not fail.

#### Timeout Rollback

saga is a long transaction, so it lasts for a large span of time, from 100ms to 1 day, so saga does not have a default timeout.

dtm supports a separate timeout for saga transactions, and when the timeout is reached, the global transaction will be rolled back.

``` go
	saga.TimeoutToFail = 1800
```

In a saga transaction, you must be careful to set the timeout time. Such transactions cannot contain branches that cannot be rolled back. Because timeout may happen after the execution of some cannot rollback branches.

#### Results of other branches as input

The previous design session descibed why dtm does not support such a requirement, so how do you handle it if there are very few actual business needs like this? For example, branch B needs the result of branch A's execution

dtm's suggested approach is to provide another interface in ServiceA so that B can get the relevant data. Although this solution is slightly less efficient, it is easy to understand and maintain, and the development workload is not too big.

If you need the results of other branches as input, you can also consider the TCC pattern inside dtm, which has different scenarios, but provides a very convenient interface to get the results of other branches

PS: There is a small detail to note, you should make network requests outside your transaction to avoid the transaction time becomes longer and lead to concurrency problems.

## SAGA Design Principles
Seata's SAGA is implemented by a state machine, while DTM's SAGA does not use a state machine. Therefore, some users often ask why DTM does not use a state machine, which can provide more flexible transaction customization.

When I designed the advanced usage of SAGA in DTM, I fully investigated the state machine implementation, and after careful weighing, I decided not to adopt it, mainly for the following reasons.

#### Ease of use
It may be that within Ali, SAGA is needed to provide similar flexibility as a state machine, but outside Ali, it is particularly rare to see users using Seata's Saga transactions. I researched the development materials for SAGA in Seata, and to get started writing a simple SAGA transaction, you need to
1. understand the principle of state machine
2. get started with the state machine GUI tool and generate the state machine definition Json (a simple distributed transaction task requires about 90+ lines of Json definition)
3. config the above Json to Java projects
4. if you encounter problems, you need to trace the debugging state machine definition of the call relationship, very complicated

In contrast, DTM's SAGA transaction is very simple and easy to use, there is no cost for developers to understand, usually five or six lines of code to complete the writing of a global transaction, so it has also become the most widely used transaction pattern in DTM. For advanced scenarios, DTM has also been tested in practice to solve complex application scenarios with extremely simple options, such as EnableConcurrent and RetryInterval. Among the user requirements collected so far, we have not seen any case that can be solved by the state function but cannot be solved by DTM's SAGA.

#### gRPC Friendliness
gRPC is a very widely used protocol in the cloud-native era. Seata's state machine, on the other hand, has a good support for HTTP and an unfriendly support for gRPC. The result returned from a gRPC service cannot be parsed without the relevant pb definition file, so it is not possible to use a state machine to make flexible judgments, and then if you want to use a state machine, you must fix the result type, which is more invasive to the application and has a narrower scope of application.

DTM, on the other hand, supports gRPC in a more friendly way, and has no requirements on the result type, which is more widely applicable.

## Summary
If you have mastered the SAGA transactions in DTM, you can solve most of the problems in distributed transactions.