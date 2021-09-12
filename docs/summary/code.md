# Code Overview

## Project organization

The dtm project has the following main directories

- app: there is only one main, which is the general entrance of dtm.
  You can pass in different parameters to run in different modes.

- common: public functions and class libraries, including logging, json, database, network, etc.

- dtmcli: dtm's http client, including tcc, saga, xa, msg transaction modes, and sub-transaction barrier

- dtmgrpc: dtm's gRPC client, including the tcc, saga, xa, msg transaction modes, and sub-transaction barrier 

- dtmsvr: dtm's server side, including http, gRPC server APIs for various transaction modes implementation

- examples: contains various examples

- test: contains various test cases

## code description

The idiomatic error handling method in Go is "error is a value", not exception.
Therefore, the interfaces provided to users in dtmcli are all in line with this standard.

The example given, however, uses the function e2p, which is a custom function that turns error into a panic.
Although it does not conform to the go specification, it reduces the amount of error-handling code and makes the code snippets shorter, allowing the user to focus on the core demo content

## Example description

The example used in dtm is mainly a distributed transaction for a transfer. 
Suppose a scenario where there is a transfer from A to B, but A and B belong to different banks and are stored in different databases.
This scenario is a typical distributed transaction scenario.
We define this distributed transaction as two sub-transactions, one for the transfer out TransOut and one for the transfer in TransIn.

Since we will often call these two sub-transactions repeatedly in the later examples, we pull out the processing of these two sub-transactions separately

### http

The http client defines the various basic operations related to TransIn and TransOut inside [examples/base_http.go](https://github.com/yedf/dtm/blob/main/examples/base_http.go), posted as follows:

``` go
func handleGeneralBusiness(c *gin.Context, result1 string, result2 string, busi string) (interface{}, error) {
	info := infoFromContext(c)
	res := common.OrString(MainSwitch.TransInResult.Fetch(), result2, "SUCCESS")
	logrus.Printf("%s %s result: %s", busi, info.String(), res)
	return M{"dtm_result": res}, nil
}

// BaseAddRoute add base route handler
func BaseAddRoute(app *gin.Engine) {
	app.POST(BusiAPI+"/TransIn", common.WrapHandler(func(c *gin.Context) (interface{}, error) {
		return handleGeneralBusiness(c, MainSwitch.TransInResult.Fetch(), reqFrom(c).TransInResult, "transIn")
	}))
	app.POST(BusiAPI+"/TransOut", common.WrapHandler(func(c *gin.Context) (interface{}, error) {
		return handleGeneralBusiness(c, MainSwitch.TransOutResult.Fetch(), reqFrom(c).TransOutResult, "TransOut")
	}))
	app.POST(BusiAPI+"/TransInConfirm", common.WrapHandler(func(c *gin.Context) (interface{}, error) {
		return handleGeneralBusiness(c, MainSwitch.TransInConfirmResult.Fetch(), "", "TransInConfirm")
	}))
	app.POST(BusiAPI+"/TransOutConfirm", common.WrapHandler(func(c *gin.Context) (interface{}, error) {
		return handleGeneralBusiness(c, MainSwitch.TransOutConfirmResult.Fetch(), "", "TransOutConfirm")
	}))
	app.POST(BusiAPI+"/TransInRevert", common.WrapHandler(func(c *gin.Context) (interface{}, error) {
		return handleGeneralBusiness(c, MainSwitch.TransInRevertResult.Fetch(), "", "TransInRevert")
	}))
	app.POST(BusiAPI+"/TransOutRevert", common.WrapHandler(func(c *gin.Context) (interface{}, error) {
		return handleGeneralBusiness(c, MainSwitch.TransOutRevertResult.Fetch(), "", "TransOutRevert")
	}))
	app.GET(BusiAPI+"/CanSubmit", common.WrapHandler(func(c *gin.Context) (interface{}, error) {
		logrus.Printf("%s CanSubmit", c.Query("gid"))
		return common.OrString(MainSwitch.CanSubmitResult.Fetch(), "SUCCESS"), nil
	}))
}
```

### grpc

The grpc client defines each basic operation related to TransIn, TransOut inside [examples/base_grpc.go](https://github.com/yedf/dtm/blob/main/examples/base_grpc.go), as follows.

``` go
func handleGrpcBusiness(in *dtmgrpc.BusiRequest, result1 string, result2 string, busi string) error {
	res := dtmcli.OrString(result1, result2, "SUCCESS")
	dtmcli.Logf("grpc busi %s %s result: %s", busi, in.Info, res)
	if res == "SUCCESS" {
		return nil
	} else if res == "FAILURE" {
		return status.New(codes.Aborted, "user want to rollback").Err()
	}
	return status.New(codes.Internal, fmt.Sprintf("unknown result %s", res)).Err()
}

func (s *busiServer) CanSubmit(ctx context.Context, in *dtmgrpc.BusiRequest) (*emptypb.Empty, error) {
	res := MainSwitch.CanSubmitResult.Fetch()
	return &emptypb.Empty{}, dtmgrpc.Result2Error(res, nil)
}

func (s *busiServer) TransIn(ctx context.Context, in *dtmgrpc.BusiRequest) (*emptypb.Empty, error) {
	req := TransReq{}
	dtmcli.MustUnmarshal(in.BusiData, &req)
	return &emptypb.Empty{}, handleGrpcBusiness(in, MainSwitch.TransInResult.Fetch(), req.TransInResult, dtmcli.GetFuncName())
}

func (s *busiServer) TransOut(ctx context.Context, in *dtmgrpc.BusiRequest) (*emptypb.Empty, error) {
	req := TransReq{}
	dtmcli.MustUnmarshal(in.BusiData, &req)
	return &emptypb.Empty{}, handleGrpcBusiness(in, MainSwitch.TransOutResult.Fetch(), req.TransOutResult, dtmcli.GetFuncName())
}

func (s *busiServer) TransInRevert(ctx context.Context, in *dtmgrpc.BusiRequest) (*emptypb.Empty, error) {
	req := TransReq{}
	dtmcli.MustUnmarshal(in.BusiData, &req)
	return &emptypb.Empty{}, handleGrpcBusiness(in, MainSwitch.TransInRevertResult.Fetch(), "", dtmcli.GetFuncName())
}

func (s *busiServer) TransOutRevert(ctx context.Context, in *dtmgrpc.BusiRequest) (*emptypb.Empty, error) {
	req := TransReq{}
	dtmcli.MustUnmarshal(in.BusiData, &req)
	return &emptypb.Empty{}, handleGrpcBusiness(in, MainSwitch.TransOutRevertResult.Fetch(), "", dtmcli.GetFuncName())
}

func (s *busiServer) TransInConfirm(ctx context.Context, in *dtmgrpc.BusiRequest) (*emptypb.Empty, error) {
	req := TransReq{}
	dtmcli.MustUnmarshal(in.BusiData, &req)
	return &emptypb.Empty{}, handleGrpcBusiness(in, MainSwitch.TransInConfirmResult.Fetch(), "", dtmcli.GetFuncName())
}

func (s *busiServer) TransOutConfirm(ctx context.Context, in *dtmgrpc.BusiRequest) (*emptypb.Empty, error) {
	req := TransReq{}
	dtmcli.MustUnmarshal(in.BusiData, &req)
	return &emptypb.Empty{}, handleGrpcBusiness(in, MainSwitch.TransOutConfirmResult.Fetch(), "", dtmcli.GetFuncName())
}
```

### Example Summary

In the above code, functions suffixed with Confirm will be called by Tcc transaction mode, those suffixed with Revert called by Tcc's Cancel and SAGA's compensate, and those suffixed with CanSubmit called by the transaction message.

In addition, MainSwitch is used for auxiliary testing, for simulating various failures.

## Client for each language

### go
Client sdk: [https://github.com/yedf/dtmcli](https://github.com/yedf/dtmcli)

Example: [https://github.com/yedf/dtmcli-go-sample](https://github.com/yedf/dtmcli-go-sample)

### dotnet

Client sdk (currently only supports TCC): [https://github.com/yedf/dtmcli-csharp](https://github.com/yedf/dtmcli-csharp)

Example: [https://github.com/yedf/dtmcli-csharp-sample](https://github.com/yedf/dtmcli-csharp-sample)

Thanks to [geffzhang](https://github.com/geffzhang) for help with the C sdk and examples, all contributed independently by [geffzhang](https://github.com/geffzhang)

### python

Client sdk (currently supports TCC, SAGA, sub-transaction barriers): [https://github.com/yedf/dtmcli-py](https://github.com/yedf/dtmcli-py)

Example: [https://github.com/yedf/dtmcli-py-sample](https://github.com/yedf/dtmcli-py-sample)

### Java

Client sdk (currently only supports TCC): [https://github.com/yedf/dtmcli-java](https://github.com/yedf/dtmcli-java)

Example: [https://github.com/yedf/dtmcli-java-sample](https://github.com/yedf/dtmcli-java-sample)

Thanks to [viticis](https://github.com/viticis) for help with the Java sdk and examples, all contributed independently by [viticis](https://github.com/viticis)

### php

Client sdk (currently only supports TCC): [https://github.com/yedf/dtmcli-php](https://github.com/yedf/dtmcli-php)

Example: [https://github.com/yedf/dtmcli-php-sample](https://github.com/yedf/dtmcli-php-sample)

Thanks to [onlyshow](https://github.com/onlyshow) for help with the php sdk and examples, all done independently by [onlyshow](https://github.com/onlyshow)

### node

Client sdk (currently only supports TCC): [https://github.com/yedf/dtmcli-node](https://github.com/yedf/dtmcli-node)

Example: [https://github.com/yedf/dtmcli-node-sample](https://github.com/yedf/dtmcli-node-sample)
