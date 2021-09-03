# TCC

TCC is an acronym for Try, Confirm, Cancel, and was first proposed by Pat Helland in 2007 in the paper called "Life beyond Distributed Transactions: an Apostate's Opinion".

## Workflow

TCC is divided into 3 phases

- Try phase: The requestor requests the service provider to perform a tentative operation.
  The provider shall complete all business validations (consistency), and reserve required business resources (quasi-isolation).

- Confirm phase: If the provider completes the Try phase successfully, the requestor can execute a confirmation operation on the provider if it decides to move forward.
  The Confirm phase is where the business is actually conducted.
  No more business validations will be performed, and only those business resources reserved in the Try phase will be used.

- Cancel phase: The requestor can execute a cancellation operation on the provider if it decides not to move forward, e.g., when the provider does not complete the Try phase successfully.
  Business resources reserved in the Try phase should be released in the Cancel phase.

Suppose we want to perform an inter-bank transfer, using TransOut and TransIn implemented in separate microservices.
A typical timing diagram for a successfully completed transaction using the TCC transaction model is as follows:

![tcc_normal](../imgs/tcc_normal.jpg)

## Simple TCC

Let's complete one of the simplest TCC:

### http
``` go
err := dtmcli.TccGlobalTransaction(DtmServer, gid, func(tcc *dtmcli.Tcc) (*resty.Response, error) {
  resp, err := tcc.CallBranch(&TransReq{Amount: 30}, Busi+"/TransOut", Busi+"/TransOutConfirm", Busi+"/TransOutRevert")
  if err != nil {
    return resp, err
  }
  return tcc.CallBranch(&TransReq{Amount: 30}, Busi+"/TransIn", Busi+"/TransInConfirm", Busi+"/TransInRevert")
})
```

### grpc
``` go
gid := dtmgrpc.MustGenGid(DtmGrpcServer)
err := dtmgrpc.TccGlobalTransaction(DtmGrpcServer, gid, func(tcc *dtmgrpc.TccGrpc) error {
  data := dtmcli.MustMarshal(&TransReq{Amount: 30})
  _, err := tcc.CallBranch(data, BusiGrpc+"/examples.Busi/TransOut", BusiGrpc+"/examples.Busi/TransOutConfirm", BusiGrpc+"/examples.Busi/TransOutRevert")
  if err != nil {
    return err
  }
  _, err = tcc.CallBranch(data, BusiGrpc+"/examples.Busi/TransIn", BusiGrpc+"/examples.Busi/TransInConfirm", BusiGrpc+"/examples.Busi/TransInRevert")
  return err
})
```

The call to TccGlobalTransaction opens a global transaction using the TCC transaction model. 
The function signature is as follows:

``` go
// TccGlobalTransaction begin a tcc global transaction
// dtm dtm server address
// gid global transaction id
// tccFunc the function representing the global transaction using the TCC transaction model. The TCC workflow(s) can be invoked in tccFunc.
func TccGlobalTransaction(dtm string, gid string, tccFunc TccGlobalFunc) error
```

When the global transaction starts, the content of function tccFunc will be called. 
In the example, inside function tccFunc, we call CallBranch twice to define two subtransactions TransOut and TransIn, each built using the TCC transaction model.

``` go
// CallBranch call a tcc branch
// It first registers functions for the Try, Confirm, and Cancel phases. If the registration is successful, the function for the Try phase is called, and the result is returned.
func (t *Tcc) CallBranch(body interface{}, tryURL string, confirmURL string, cancelURL string) (*resty.Response, error)
```

When tccFunc returns normally, TccGlobalTransaction commits the global transaction that contains all TCC workflows, and returns to the caller. 
DTM receives the request to commit, and calls the functions for the Confirm phase that are registered for all TCC workflows.
When tccGlobalTransaction returns, all functions for the Try phase have completed, but those for the Confirm phase are usually not yet completed.

### Rollback upon failure

If tccFunc returns an error, TccGlobalTransaction terminates the global transaction and returns to the caller. 
DTM receives the request to terminate, and calls the functions for the Cancel phase that are registered for all TCC workflows.

Let's purposely fail the second TCC workflow in the global transaction by passing the argument and watch what happens.

``` go
res2, rerr := tcc.CallBranch(&TransReq{Amount: 30, TransInResult: "FAILURE"}, Busi+"/TransIn", Busi+"/TransInConfirm", Busi+"/TransInRevert")
```

The timing diagram for failure is as follows:

![tcc_rollback](../imgs/tcc_rollback.jpg)

## Nesting

DTM supports nested TCC subtransactions as shown in the following code (taken from [examples/http_tcc](https://github.com/yedf/dtm/blob/main/examples/http_tcc.go)).

``` go
err := dtmcli.TccGlobalTransaction(DtmServer, gid, func(tcc *dtmcli.Tcc) (*resty.Response, error) {
  resp, err := tcc.CallBranch(&TransReq{Amount: 30}, Busi+"/TransOut", Busi+"/TransOutConfirm", Busi+"/TransOutRevert")
  if err != nil {
    return resp, err
  }
  return tcc.CallBranch(&TransReq{Amount: 30}, Busi+"/TransInTccParent", Busi+"/TransInConfirm", Busi+"/TransInRevert")
})
```

Here the TransInTccParent subtransaction will call the TransIn subtransaction, as shown in the following code:

``` go
app.POST(BusiAPI+"/TransInTccParent", common.WrapHandler(func(c *gin.Context) (interface{}, error) {
  tcc, err := dtmcli.TccFromReq(c)
  e2p(err)
  logrus.Printf("TransInTccParent ")
  return tcc.CallBranch(&TransReq{Amount: reqFrom(c).Amount}, Busi+"/TransIn", Busi+"/TransInConfirm", Busi+"/TransInRevert")
}))
```

Within the nested TCC subworkflow, the tcc object can be constructed from the incoming request, and then used normally for business operations.

More documentation of nested TCC, including the timing diagrams, will be added in future.

### Summary

In this section of the tutorial, we have briefly introduced the TCC transaction model.
After describing the theory of TCC, we gave an overall picture of how to write a global transaction using TCC with several examples, covering both normal successful completion and failure rollback scenarios. 
Nested TCC is also demonstrated.


