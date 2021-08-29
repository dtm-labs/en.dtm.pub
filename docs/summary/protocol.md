# Interface protocols

## Inter-role communication protocols

Currently, dtm only supports http and grpc protocols. 
Since distributed transactions involve multiple roles collaborating, some participants may appear temporarily unavailable and need to retry; some participants are explicitly informed of the failure and need to be rolled back.

### HTTP

The following is a breakdown of the various cases, defining the return values for each type of case. 
Interface is similar to the WeChat/Alipay order callback interface: if the interface returns a result containing SUCCESS, it means success; if the interface returns a result containing FAILURE, it means failure; others indicate an error and need to retry.

In the above architecture diagram, there are mainly the following types of interfaces:

AP calls the interface of TM, mainly for global transaction registration, commit, subtransaction registration, etc:
  - Success: { dtm_result: "SUCCESS" }
  - Fail: { dtm_result: "FAILURE" }, indicating that the status of the request is not correct, e.g. a global transaction that has gone FAIL is not allowed to register branches again
  - Others indicate that the status is uncertain and can be retried

TM calls the RM interface, mainly for the two-stage commit, rollback, and the branches of saga
  - Success: { dtm_result: "SUCCESS" }, means that the interface call was successful and the next step will be performed normally
  - Failure: { dtm_result: "FAILURE" }, means that the interface call failed and the global transaction needs to be rolled back. For example, if a forward operation in saga returns FAILURE, the entire saga transaction fails to roll back.
  - The other result indicates further retrial, and TM keeps retrying until it returns one of the above two results

AP calls RM's interface, which is business related, and mainly called in two modes, TCC and XA. 
Considering that many microservices are governed by a failure retry mechanism, it is recommended that the interface be designed as follows:
  - success: { dtm_result: "SUCCESS" }, indicating that this interface call is successful and the next operation is performed normally. 
    The returned result can additionally contain other business data.
  - Failure: { dtm_result: "FAILURE" }, meaning that the interface call failed and the global transaction needs to be rolled back. 
    For example, if the Try action in tcc returns FAILURE, the entire tcc global transaction is rolled back
  - Other return values, should be allowed to retry.
    If further retry still fails, thw design should allow the global transaction to rollback. 
    Mainly because the next operation of the TCC or XA transaction is not saved in the database, but in the AP, it needs to respond to the user in a timely manner, and can not wait a long time for failure recovery.

::: tip interface data notes
dtm checks if resp.String() contains SUCCESS/FAILURE to determine success and failure, so please avoid including these two words in the business data returned by the subtransaction interface.
:::

### GRPC

Since GRPC is a strongly typed protocol and has defined individual error status codes and is able to define different error codes with different retry strategies, the GRPC protocol is as follows.
- Aborted: indicates failure and needs to be rolled back, corresponding to { dtm_result: "FAILURE" } in the above http protocol.
- OK: means the call was successful, corresponding to { dtm_result: "SUCCESS" } in the above http protocol, you can proceed to the next step
- Other errors?: Status unknown, can retry

AP calls the interface of TM, mainly for global transaction registration, commit, subtransaction registration, etc:
- No return value.
  Check error to see if it is nil, Aborted, or other

``` go
type DtmServer interface {
  ...
  Submit(context.Context, *DtmRequest) (*emptypb.Empty, error)
}
```

TM calls RM's interface, mainly for two-stage commit, rollback, and each branch of saga
- No return value.
  Check error if it is nil, Aborted, or other
- the argument dtmgrpc.BusiRequest, which contains BusiData, is the data passed to TM by AP, and will be transparently passed to RM
``` go
type BusiRequest struct {
	Info *BranchInfo
	Dtm string
	BusiData []byte
}

type BusiReply struct {
	BusiData []byte
}

type BusiClient interface {
  ...
  TransIn(ctx context.Context, in *dtmgrpc.BusiRequest, opts ... grpc.CallOption) (*emptypb.BusiReply, error)
```

AP calls RM's interface, which is business related and is mainly called in two modes, TCC and XA. Returned results

- dtmgrpc.BusiReply. If the application needs to use the data, it needs its own Unmarshal to parse the BusiData

``` go
type BusiClient interface {
  ...
  TransInTcc(ctx context.Context, in *dtmgrpc.BusiRequest, opts ...grpc.CallOption) (*dtmgrpc.BusiReply, error)
```

## Retry policy

Retry upon failure is a very important part of microservice governance.
The http and grpc protocols described above are well compatible with the mainstream strategies for retry upon failure.

When the global transaction faces temporary failure caused by some components, the global transaction will be temporarily interrupted.
Subsequently, dtm will regularly poll the global transaction that is uncompleted due to time out within one hour to retry. Intervals between sucessive retries are doubled to avoid avalanches.

If the application does not retry the uncompleted global transaction within one hour, probably due to various bugs or failures, developers can manually modify the next_cron_time in dtm.trans_global to trigger a retry after they fix the bugs or failures.
