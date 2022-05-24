# How to Manage Anomalies in Saga Pattern in Microservices

Saga is the most common pattern for ensuring cross-service data consistency. It splits a global transaction into multiple sub-transactions, and if all sub-transaction operations succeed, then the global transaction succeeds, and if one sub-transaction still fails after retries, then all executed sub-transactions are compensated.

The above process is simple and clear, but in a distributed environment, there are anomalies that can occur. It is not an easy job to ensure that a Saga transaction is working correctly and to keep the data in consistent. We will discuss the various anomalies that can occur here and how to manage them.

For the purposes of discussion, we will refer to the forward action of a branch transaction in Saga as `Action` and the compensating action as `Compensation`.

## Three Types of Anomalies

Normally, the `Action` is executed before the `Compensation` in Saga transactions if rollback happens. But due to network delays, or process pauses, it is possible that the `Compensation` is executed first and the `Action` is executed later or not at all.

This scenarios introduces two anomalies in distributed transactions:
1. Null Compensation: When `Compensation` is executing, the corresponding `Action` has not been executed, so the `Compensation` needs to determine that the `Action` has not been executed, ignore the business data updates, and return directly.
2. Hanging Action: When the `Action` is executing, the `Compensation` has been executed, so the `Action` needs to determine that the `Compensation` has been executed, ignore the business data updates, and return directly

Another common anomaly that needs to be dealt with in distributed transactions is `Duplicated Requests`. When a process crashes and Saga retries the service, the service may be called multiple times, so idempotent processing is needed.

These three types of anomalies need to be managed carefully, otherwise data inconsistencies can occur and disrupt the business.

## Solution

[https://github.com/dtm-labs/dtm](https://github.com/dtm-labs/dtm) pioneered a technique name `Sub-transaction Barrier` for managing these three types of anomalies at the same time. For Saga pattern, the principle is as follows.

1. Create a table dtm_barrier.barrier in the local database, with a unique index of `gid-branchid-branchop`
2. Begin a local transaction
3. In `Action` and `Compensation`, insert ignore a row `gid-branchid-action|compensation`, if the number of affected rows is 0 (in case of Duplicate Requests, Hanging Action), commit directly and return
4. In `Compensation`, insert ignore an additional row `gid-branchid-action`, if the number of rows affected is 1 (in case of Null Compensation), commit directly and return
5. Execute business logic and commit, or roll back if errors occur

### Duplicated Requests
Because of the unique index above, insertion in duplicated requests are guaranteed to be ignored and business processing is skipped

### Null Compensation
When a null compensation occurs, a successful insertion of step 3 and an ignored insertion of step 4 will be committed directly and returned, skipping the business logic.

### Hanging Action
When `Hanging Action` occurs, the compensation has been executed and a row `gid-branchid-action` has been inserted, so in `Action`, it will find that the insertion at step 3 was ignored and then return directly, skipping the business logic

### Action and Compensation Overlap

If `Action` and `Compensation` overlap in execution time, both `Compensation` and `Action` will insert the same row `gid-branchid-action`. Due to a unique index conflict, only one of the two operations will succeed, while the other will wait for the transaction holding the lock to complete and then return.

- Scenario 1: The `Action` fails and the `Compensation` succeeds in inserting `gid-branchid-action`. This is a typical `Null Compensation` and `Hanging Action` scenario and both `Action` and `Compensation` will ignore the business logic and return directly according to the above algorithm
- Scenario 2: The `Action` succees and the `Compensation` fails in inserting `gid-branchid-action`. The order of transaction execution is `Action` before `Compensation`, and no anomaly occur. According to the above algorithm, the business in `Action` and `Compensation` will be executed orderly
- Scenario 3, If the database go down during the overlap, the operations will be retried and will eventually go to scenario 1 or 2.

In summary of the above scenarios, the `Sub-transaction Barrier` is able to properly manage the anomalies and ensure the data consistency.

The algorithm described above also applies to TCC distributed transactions. Even if you are using a workflow engine, such as Candence, Camunda, to handle Saga transactions, the algorithm also applies.

## Code
The above `Sub-transaction Barrier` technique, when used in conjunction with the distributed transaction framework [https://github.com/dtm-labs/dtm](https://github.com/dtm-labs/dtm), has been made available in several language [SDKs](https://en.dtm.pub/ref/sdk), with the following example code in Go.

``` Go
app.POST(BusiAPI+"/SagaBTransOut", dtmutil.WrapHandler(func(c *gin.Context) interface{} {
  barrier := MustBarrierFromGin(c)
  return barrier.Call(txGet(), func(tx *sql.Tx) error {
    return SagaAdjustBalance(tx, TransOutUID, -reqFrom(c).Amount, "")
  })
}))
app.POST(BusiAPI+"/SagaBTransOutCom", dtmutil.WrapHandler(func(c *gin.Context) interface{} {
  barrier := MustBarrierFromGin(c)
  return barrier.Call(txGet(), func(tx *sql.Tx) error {
    return SagaAdjustBalance(tx, TransOutUID, reqFrom(c).Amount, "")
  })
}))
```

In `TransOut` service, the first line is to create a barrier from http request, and the next several lines call the business inside the barrier.

When we put business processing inside a sub-transaction barrier, the various anomalies described earlier, are filtered and the developer only needs to consider the business processing under normal flow.

The complete example can be found here: [https://github.com/dtm-labs/dtm-examples](https://github.com/dtm-labs/dtm-examples). After `dtm` setup, you can run a complete example by following command:
`go run main.go http_saga_barrier`

## Conclusion

This article propose an algorithm to handle anomalies in Saga pattern for microservices. It is elegant and efficient, which can apply to TCC pattern, and also apply to many workflows.

You are welcomed to visit [https://github.com/dtm-labs/dtm](https://github.com/dtm-labs/dtm). It is an opensourced project dedicated to ease the development of distributed transactions.