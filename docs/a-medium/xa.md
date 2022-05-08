# XA Transactions with Pratical Examples

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
XA start '4fPqCNTYeSG' -- start a xa transaction
UPDATE `user_account` SET `balance`=balance + 30,`update_time`='2021-06-09 11:50:42.438' WHERE user_id = '1'
XA end '4fPqCNTYeSG'
-- if connection closed before prepare, then the transaction is rollback automaticly
XA prepare '4fPqCNTYeSG'

-- When all participants have finished prepare, go to the second stage commit
xa commit '4fPqCNTYeSG'
```

## XA hands-on

Let's complete a full XA.
Let's start with a successful XA timing diagram:

![xa_normal](../imgs/xa_normal.jpg)

#### http

``` go
	gid := dtmcli.MustGenGid(dtmutil.DefaultHTTPServer)
	err := dtmcli.XaGlobalTransaction(dtmutil.DefaultHTTPServer, gid, func(xa *dtmcli.Xa) (*resty.Response, error) {
		resp, err := xa.CallBranch(&busi.TransReq{Amount: 30}, busi.Busi+"/TransOutXa")
		if err != nil {
			return resp, err
		}
		return xa.CallBranch(&busi.TransReq{Amount: 30}, busi.Busi+"/TransInXa")
	})

app.POST(BusiAPI+"/TransInXa", dtmutil.WrapHandler2(func(c *gin.Context) interface{} {
	return dtmcli.XaLocalTransaction(c.Request.URL.Query(), BusiConf, func(db *sql.DB, xa *dtmcli.Xa) error {
		return AdjustBalance(db, TransInUID, reqFrom(c).Amount, reqFrom(c).TransInResult)
	})
}))
app.POST(BusiAPI+"/TransOutXa", dtmutil.WrapHandler2(func(c *gin.Context) interface{} {
	return dtmcli.XaLocalTransaction(c.Request.URL.Query(), BusiConf, func(db *sql.DB, xa *dtmcli.Xa) error {
		return AdjustBalance(db, TransOutUID, reqFrom(c).Amount, reqFrom(c).TransOutResult)
	})
}))
```

The above code first registers a global XA transaction, then adds two sub-transactions TransOut, TransIn.
After all the sub-transactions are executed successfully, the global XA transaction is committed to DTM.
DTM receives the committed xa global transaction, and calls the xa commit of all the sub-transactions to complete the whole xa transaction.

## Rollback upon failure

If a prepare phase operation fails, DTM will call xa rollback of each child transaction to roll back, and the transaction is successfully rolled back at last.

Let's pass TransInResult=FAILURE in the request load of XaFireRequest to fail purposely.

``` go
req := &busi.TransReq{Amount: 30, TransInResult: "FAILURE"}
```

The timing diagram for failure is as follows:

![xa_rollback](../imgs/xa_rollback.jpg)

### Notices
- The XA transaction interface for dtm has undergone a change in v1.13.0 to significantly simplify the use of XA transactions, and is overall consistent with the TCC interface and easier to get started with.
- The second stage of XA transaction processing, the final commit or rollback of a branch, is also sent to the API `BusiAPI+"/TransOutXa"`, and within this service, `dtmcli.XaLocalTransaction` will automatically do `xa commit | xa rollback`. The body of the request is nil, so operations like parsing the body, such as the previous `reqFrom`, need to be placed inside `XaLocalTransaction`, otherwise the body parsing will result in errors.

### Summary
The features of XA transactions are
- Simple and easy to understand
- Easy to develop, rollback and other operations are done automatically by the underlying database
- Long locking of resources, low concurrency, not suitable for highly concurrent operations
