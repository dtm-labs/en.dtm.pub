# Workflow Mode

The Workflow pattern is a pattern first introduced by DTM. Under this pattern, a mixture of XA, SAGA and TCC can be used, allowing users to customise most of the contents of a distributed transaction, providing great flexibility.

## workflow example
In Workflow mode, both HTTP and gRPC protocols can be used. The following is an example of the gRPC protocol, which is divided into the following steps.
- Initialise the SDK
- Register workflow
- Executing workflow

#### First you need to initialise the SDK's workflow before you can use it.

``` Go
import "github.com/dtm-labs/dtmgrpc/workflow"

// Initialize the workflow SDK with three parameters.
// the first parameter, the dtm server address
// the second parameter, the business server address
// The third parameter, grpcServer
// workflow needs to receive the dtm server callback from the "business server address" + "grpcServer"
workflow.InitGrpc(dtmGrpcServer, busi.BusiGrpc, gsvr)
```

#### Then you need to register workflow's handler function
``` Go
wfName := "wf_saga"
err := workflow.Register(wfName, func(wf *workflow.Workflow, data []byte) error {
  req := MustUnmarshalReqGrpc(data)
  wf.NewBranch().OnRollback(func(bb *dtmcli.BranchBarrier) error {
    _, err := busi.BusiCli.TransOutRevert(wf.Context, req)
    return err
  })
  _, err := busi.BusiCli.TransOut(wf.Context, req)
  if err ! = nil {
    return err
  }
  wf.NewBranch().OnRollback(func(bb *dtmcli.BranchBarrier) error {
    _, err := busi.BusiCli.TransInRevert(wf.Context, req)
    return err
  })
  _, err = busi.BusiCli.TransIn(wf.Context, req)
  return err
})
```

- This registration operation needs to be executed after the business service is started, because when the process crashes, dtm will call back to the business server to continue the unfinished task
- The above code `NewBranch` will create a transaction branch, one that will include a forward action and a callback on global transaction commit/rollback
- `OnRollback/OnCommit` will register a callback on global transaction rollback/commit for the current transaction branch, in the above code, only `OnRollback` is specified, so it is in Saga mode
- The `busi.BusiCli` in the above code needs to add a workflow interceptor which will automatically record the results of the rpc request to dtm as follows
``` Go
conn1, err := grpc.Dial(busi.BusiGrpc, grpc.WithUnaryInterceptor(workflow.Interceptor), nossl)
busi.BusiCli = busi.NewBusiClient(conn1)
```

You can of course add `workflow.Interceptor` to all gRPC clients, this middleware will only handle requests under `wf.Context` and `wf.NewBranchContext()`

- When the workflow function returns nil/ErrFailure, the global transaction enters the Commit/Rollback phase, calling the operations registered in OnCommit/OnRollback inside the function in reverse order

#### Finally the workflow is executed
``` Go
req := &busi.ReqGrpc{Amount: 30}
err = workflow.Execute(wfName, shortuuid.New(), dtmgimp.MustProtoMarshal(req))
```

- When the result of Execute is `nil/ErrFailure`, the global transaction has succeeded/been rolled back.
- When the result of Execute is other values, the dtm server will subsequently call back this workflow task to retry

## Principle of workflow
How does workflow ensure data consistency in distributed transactions? When a business process has a crash or other problem, the dtm server will find that this workflow global transaction has timed out and not completed, then the dtm server will use an exponential retreat algorithm and retry the workflow transaction. When the workflow retry request reaches the business service, the SDK will query the progress of the global transaction from the dtm server, and for the completed branch, it will take the previously saved result and return the branch result directly through an interceptor such as gRPC/HTTP. Eventually the workflow will complete successfully.

Workflow functions need to be idempotent, i.e. the first call, or subsequent retries, should get the same result

## Saga in Workflow
The core idea of the Saga pattern, derived from this paper [SAGAS](https://www.cs.cornell.edu/andru/cs711/2002fa/reading/sagas.pdf), is that long transactions are split into short transactions, coordinated by the Saga transaction coordinator, and if each short transaction operation successfully completes, then the global transaction completes normally, and if a step fails, the compensating operations are invoked one at a time in reverse order.

In Workflow mode, you can call the function for the operation directly in the function and then write the compensation operation to `OnRollback` of the branch, and then the compensation operation will be called automatically, achieving the effect of Saga mode

## Tcc under Workflow
The Tcc pattern is derived from this paper [Life beyond Distributed Transactions: an Apostate's Opinion](https://www.ics.uci.edu/~cs223/papers/cidr07p15. pdf), he divides a large transaction into multiple smaller transactions, each of which has three operations.
- Try phase: attempts to execute, completes all business checks, set aside enough business resources
- Confirm phase: if the Try operation succeeds on all branches, it goes to the Confirm phase, which actually executes the transaction without any business checks, using only the business resources set aside in the Try phase
- Cancel phase: If one of the Try operations from all branches fails, we go to the Cancel phase, which releases the business resources reserved in the Try phase.

For our scenario of an inter-bank transfer from A to B, if SAGA is used and the balance is adjusted in the forward operation, and is adjusted reversely in the compensating operation, then the following scenario would occur.
- A deducts the money successfully
- A sees the balance decrease and tells B
- The transfer of the amount to B fails and the whole transaction is rolled back
- B never receives the funds

This causes great distress to both ABs. This situation cannot be avoided in SAGA, but it can be resolved by TCC with the following design technique.
- Introduce a trading_balance field in addition to the balance field in the account
- Try phase to check if the account is frozen, check if the account balance-trading_balance is sufficient, and then adjust the trading_balance (i.e. the funds frozen for business purposes)
- Confirm phase, adjust balance, adjust trading_balance (i.e. unfrozen funds for the business)
- Cancel phase, adjust trading_balance (i.e. unfrozen funds on the business)

In this case, once end user A sees his balance deducted, then B must be able to receive the funds

In Workflow mode, you can call the `Try` operation directly in the function, then register the `Confirm` operation to `OnCommit` in the branch and register the `Cancel` operation to `OnRollback` in the branch, achieving the effect of the `Tcc` mode

## XA under Workflow
XA is a specification for distributed transactions proposed by the X/Open organization. The XA specification essentially defines the interface between a (global) Transaction Manager (TM) and a (local) Resource Manager (RM). Local databases such as mysql play the RM role in the XA

XA is divided into two phases.

- Phase 1 (prepare): i.e. all participants RM prepare to execute the transaction and lock the required resources. When the participants are ready, they report to TM that they are ready.
- Phase 2 (commit/rollback): When the transaction manager (TM) confirms that all participants (RMs) are ready, it sends a commit command to all participants.

Currently all major databases support XA transactions, including mysql, oracle, sqlserver, postgres

In Workflow mode, you can call `NewBranch().DoXa` in the workflow function to open your XA transaction branch.

## Mixing multiple modes
In Workflow mode, Saga, Tcc and XA as described above are all patterns of branching transactions, so you can use one pattern for some branches and another pattern for others. The flexibility offered by this mixture of patterns allows for sub-patterns to be chosen according to the characteristics of the branch transaction, so the following is recommended.
- XA: If the business has no row lock contention, and the global transaction will not last long, then XA can be used. This pattern requires less additional development and `Commit/Rollback` is done automatically by the database. For example, this pattern is suitable for order creation business, where different orders lock different order rows and have no effect on concurrency between each other; it is not suitable for deducting inventory, because orders involving the same item will all compete for the row lock of this item, which will lead to low concurrency.
- Saga: common business that is not suitable for XA can use this model, this model has less extra development than Tcc, only need to develop forward operation and compensation operation
- Tcc: suitable for high consistency requirements, such as the transfer described earlier, this pattern has the most additional development and requires the development of operations including `Try/Confirm/Cancel`

## idempotency requirements
In the Workflow pattern, when a crash occurs, a retry is performed, so the individual operations are required to support idempotency, i.e. the result of the first call is the same as the next tries, returning the same result. In business, the `unique key` of the database is usually used to achieve idempotency, specifically `insert ignore "unique-key"`, if the insert fails, it means that this operation has been completed, this time directly ignored to return; if the insert succeeds, it means that this is the first operation, continue with the subsequent business operations.

If your business itself is idempotent, then you can operate your business directly; if your business doesnot provides idempotent functionality, then dtm provides a `BranchBarrier` helper class, based on the above unique-key principle, which can easily help developers implement idempotent operations for `Mysql/Mongo/Redis`.

Please note that the following two are typical non-idempotent operations.
- Timeout rollback: If you have an operation in your business that may take a long time, and you want your global transaction to roll back after waiting for the timeout to return a failure. Then this is not an idempotent operation because in the extreme case of two processes calling the operation at the same time, one returns a timeout failure and the other a success, resulting in different results
- Rollback after reaching the retry limit: the analysis process is the same as above.

Workflow mode does not support the above timeout rollback and retry limit rollback at the moment, if you have a relevant scenario, please send us the specific scenario, we will actively consider whether to add this kind of support

## Branch Operation Results
Branching operations will return the following results.
- Success: the branch operation returns `HTTP-200/gRPC-nil`
- Business failure: the branch operation returns `HTTP-409/gRPC-Aborted`, no more retries, and the global transaction needs to be rolled back
- In progress: branch operation returns `HTTP-425/gRPC-FailPrecondition`, this result indicates that the transaction is in progress normally and requires the dtm to retry not with the exponential retreat algorithm but with fixed interval retries
- Unknown error: the branch operation returns other results, indicating an unknown error, and dtm will retry this workflow, using the exponential retreat algorithm

If your existing service has a different result to the above, then you can customise this part of the result with `workflow.Options.HTTPResp2DtmError/GRPCError2DtmError`

Saga's Compensation operation and Tcc's Confirm/Cancel operation are not allowed to return business failures according to the Saga and Tcc protocols, because when in the second stage of the workflow, Commit/Rollback, is neither successful nor allowed to retry, then the global transaction cannot be completed, so please take care to avoid this when designing

## Transaction Completion Notification
Some business scenarios where you want to be notified of the completion of a transaction can be achieved by setting an `OnFinish` callback on the first transaction branch. By the time the callback is called, all business operations have been performed and the global transaction is therefore substantially complete. The callback function can determine whether the global transaction has finally been committed or rolled back based on the `isCommit` passed in.

One thing to note is that when the `OnFinish` callback is called, the state of the transaction has not yet been modified to final state on the dtm server, so if you use a mixture of transaction completion notifications and querying global transaction results, the results of the two may not be consistent, and it is recommended that users use only one of these methods rather than a mixture.

## Comming soom
- Gradually improve the workflow examples and documentation
- Support branch transaction concurrency