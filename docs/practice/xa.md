# XA

## What is XA

XA is a specification for distributed transactions proposed by the X/Open organization. 
The XA specification mainly defines the interface between a (global) Transaction Manager (TM) and a (local) Resource Manager (RM). 
Local databases such as mysql play the RM role in the XA specification.

XA is divided into two phases.

 - Phase 1 (prepare): All participating RMs prepare to execute their transactions and lock the required resources. 
   When the participants are ready, they report to TM that they are ready.

 - Phase 2 (commit/rollback): When the transaction manager (TM) confirms that all participants (RM) are ready, it sends a commit command to all participants.

At present, almost all mainstream databases support XA transactions, including mysql, oracle, sqlserver, postgre

Let's see how the local database supports XA.

Phase 1 Preparation

``` sql
XA start '4fPqCNTYeSG'
UPDATE `user_account` SET `balance`=balance + 30,`update_time`='2021-06-09 11:50:42.438' WHERE user_id = '1'
XA end '4fPqCNTYeSG'
XA prepare '4fPqCNTYeSG'
-- When all participants have finished prepare, go to the second stage commit
xa commit '4fPqCNTYeSG'
```

## XA hands-on

Let's complete a full XA. 
Let's start with a successful XA timing diagram:

![xa_normal](../imgs/xa_normal.jpg)

Since the XA pattern requires the use of local database functions, we cannot reuse the previous generic processing functions.
The whole amount of code will be a bit more complex than the simplest examples of several other patterns.

### http

``` go
// XaSetup mounts the http api and creates XaClient
func XaSetup(app *gin.Engine) {
	app.POST(BusiAPI+"/TransInXa", common.WrapHandler(xaTransIn))
	app.POST(BusiAPI+"/TransOutXa", common.WrapHandler(xaTransOut))
	var err error
	XaClient, err = dtmcli.NewXaClient(DtmServer, config.DB, Busi+"/xa", func(path string, xa *dtmcli.XaClient) {
		app.POST(path, common.WrapHandler(func(c *gin.Context) (interface{}, error) {
			return xa.HandleCallback(c.Query("gid"), c.Query("branch_id"), c.Query("action"))
		}))
	})
	e2p(err)
}

// XaFireRequest registers a global XA transaction that calls the XA branch
func XaFireRequest() string {
	gid := dtmcli.MustGenGid(DtmServer)
	res, err := XaClient.XaGlobalTransaction(gid, func(xa *dtmcli.Xa) (interface{}, error) {
		resp, err := xa.CallBranch(&TransReq{Amount: 30}, Busi+"/TransOutXa")
		if dtmcli.IsFailure(resp, err) {
			return resp, err
		}
		return xa.CallBranch(&TransReq{Amount: 30}, Busi+"/TransInXa")
	})
	dtmcli.PanicIfFailure(res, err)
	return gid
}

func xaTransIn(c *gin.Context) (interface{}, error) {
	return XaClient.XaLocalTransaction(c, func(db *sql.DB, xa *dtmcli.Xa) (interface{}, error) {
		if reqFrom(c).TransInResult == "FAILURE" {
			return M{"dtm_result": "FAILURE"}, nil
		}
		_, err := common.SdbExec(db, "update dtm_busi.user_account set balance=balance+? where user_id=?", reqFrom(c).Amount, 2)
		return M{"dtm_result": "SUCCESS"}, err
	})
}

func xaTransOut(c *gin.Context) (interface{}, error) {
	return XaClient.XaLocalTransaction(c, func(db *sql.DB, xa *dtmcli.Xa) (interface{}, error) {
		if reqFrom(c).TransOutResult == "FAILURE" {
			return M{"dtm_result": "FAILURE"}, nil
		}
		_, err := common.SdbExec(db, "update dtm_busi.user_account set balance=balance-? where user_id=?", reqFrom(c).Amount, 1)
		return M{"dtm_result": "SUCCESS"}, err
	})
}
```

### grpc

``` go
	XaGrpcClient = dtmgrpc.NewXaGrpcClient(DtmGrpcServer, config.DB, BusiGrpc+"/examples.Busi/XaNotify")

	gid := dtmgrpc.MustGenGid(DtmGrpcServer)
	busiData := dtmcli.MustMarshal(&TransReq{Amount: 30})
	err := XaGrpcClient.XaGlobalTransaction(gid, func(xa *dtmgrpc.XaGrpc) error {
		_, err := xa.CallBranch(busiData, BusiGrpc+"/examples.Busi/TransOutXa")
		if err != nil {
			return err
		}
		_, err = xa.CallBranch(busiData, BusiGrpc+"/examples.Busi/TransInXa")
		return err
	})

func (s *busiServer) XaNotify(ctx context.Context, in *dtmgrpc.BusiRequest) (*emptypb.Empty, error) {
	err := XaGrpcClient.HandleCallback(in.Info.Gid, in.Info.BranchID, in.Info.BranchType)
	return &emptypb.Empty{}, dtmgrpc.Result2Error(nil, err)
}

func (s *busiServer) TransInXa(ctx context.Context, in *dtmgrpc.BusiRequest) (*emptypb.Empty, error) {
	req := TransReq{}
	dtmcli.MustUnmarshal(in.BusiData, &req)
	return &emptypb.Empty{}, XaGrpcClient.XaLocalTransaction(in, func(db *sql.DB, xa *dtmgrpc.XaGrpc) error {
		if req.TransInResult == "FAILURE" {
			return status.New(codes.Aborted, "user return failure").Err()
		}
		_, err := dtmcli.SdbExec(db, "update dtm_busi.user_account set balance=balance+? where user_id=?", req.Amount, 2)
		return err
	})
}

func (s *busiServer) TransOutXa(ctx context.Context, in *dtmgrpc.BusiRequest) (*emptypb.Empty, error) {
	req := TransReq{}
	dtmcli.MustUnmarshal(in.BusiData, &req)
	return &emptypb.Empty{}, XaGrpcClient.XaLocalTransaction(in, func(db *sql.DB, xa *dtmgrpc.XaGrpc) error {
		if req.TransOutResult == "FAILURE" {
			return status.New(codes.Aborted, "user return failure").Err()
		}
		_, err := dtmcli.SdbExec(db, "update dtm_busi.user_account set balance=balance-? where user_id=?", req.Amount, 1)
		return err
	})
}

```

The above code first registers a global XA transaction, then adds two sub-transactions TransOut, TransIn. 
After all the sub-transactions are executed successfully, the global XA transaction is committed to DTM. 
DTM receives the committed xa global transaction, and calls the xa commit of all the sub-transactions to complete the whole xa transaction.

### Rollback upon failure

If a prepare phase operation fails, DTM will call xa rollback of each child transaction to roll back, and the transaction is successfully rolled back at last.

Let's pass TransInResult=FAILURE in the request load of XaFireRequest to fail purposely. 

``` go
req := &examples.TransReq{Amount: 30, TransInResult: "FAILURE"}
```

The timing diagram for failure is as follows:

![xa_rollback](../imgs/xa_rollback.jpg)

