# Go-zero Support
dtm has collaborated deeply with go-zero to create a go-zero native support solution for distributed transactions, providing a minimalist user experience. Thanks to go-zero author [kevwan](https://github.com/kevwan) for his support

Dtm supports the go-zero microservices framework natively from v1.6.0 onwards. go-zero version requires v1.2.4 or higher

## Run An Existing Example
Let's run an example of go-zero using etcd as a registry service centre as follows.

- Start etcd
```
# Prerequisite: etcd is installed
etcd
```
- Configure dtm
```
MicroService:
  Driver: 'dtm-driver-gozero' # Configure dtm to use go-zero's microservice protocol
  Target: 'etcd://localhost:2379/dtmservice' # Register dtm to this address in etcd
  EndPoint: 'localhost:36790' # local address for dtm
```
- Start dtm
```
# Prerequisite: conf.yml properly configured
go run app/main.go -c conf.yml
```
- Run a go-zero service
```
git clone https://github.com/dtm-labs/dtmdriver-clients && cd dtmdriver-clients
cd gozero/trans && go run trans.go
```
- Initiate a go-zero transaction using dtm
```
# In the directory of dtmdriver-clients
cd gozero/app && go run main.go
```

When you see the log of gozero/trans:
```
2021/12/03 15:44:05 transfer out 30 cents from 1
2021/12/03 15:44:05 transfer in 30 cents to 2
```
The transaction completed properly

## Development Access
Refer to the code in [dtm-labs/dtmdriver-clients](https://github.com/dtm-labs/dtmdriver-clients/blob/main/gozero/app/main.go)

``` go
// The following line imports gozero's dtm driver
import _ "github.com/dtm-labs/driver-gozero"

// dtm has been registered to the following address via the previous configuration, so use that address in dtmgrpc
var dtmServer = "etcd://localhost:2379/dtmservice"

// Load the configuration from the config file below and then get the address of the business service via BuildTarget
var c zrpc.RpcClientConf
conf.MustLoad(*configFile, &c)
busiServer, err := c.BuildTarget()

  // Use dtmgrpc to generate a message-based distributed transaction and commit it
	gid := dtmgrpc.MustGenGid(dtmServer)
	msg := dtmgrpc.NewMsgGrpc(dtmServer, gid).
    // The first step of the transaction is to call trans.TransSvcClient.TransOut
    // You can find the Method name for the above method in trans.pb.go as "/trans.TransSvc/TransOut"
    // dtm needs to call this method from the dtm server, so it does not take a strong type
    // Instead, it takes the dynamic url: busiServer+"/trans.TransSvc/TransOut"
		Add(busiServer+"/trans.TransSvc/TransOut", &busi.BusiReq{Amount: 30, UserId: 1}).
		Add(busiServer+"/trans.TransSvc/TransIn", &busi.BusiReq{Amount: 30, UserId: 2})
	err := msg.Submit()

```

The whole process is quite simple, and the previous comments are clear enough.


#### Caution
When looking for the path to the grpc method (`/trans.TransSvc/TransOut`) in the *.pb.go file, be sure to copy from `Invoke` call:
``` go
func (c *transSvcClient) TransOut(ctx context.Context, in *AdjustInfo, opts ...grpc.CallOption) (*Response, error) {
	out := new(Response)
	err := c.cc.Invoke(ctx, "/trans.TransSvc/TransOut", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}
```

## Deeper Understanding Of Dynamic Calls
When using dtm's distributed transactions in go-zero, many of the calls are initiated from the dtm server, e.g. Confirm/Cancel for TCC, all calls for SAGA/MSG.

Dtm does not need to know the strong type of the relevant business api that make up the distributed transaction, it calls these api dynamically.

The call to grpc can be compared to an HTTP POST, where

- c.BuildTarget() produces a target similar to Host in the URL
- "/trans.TransSvc/TransOut" is equivalent to Path in the URL
- &busi.BusiReq{Amount: 30, UserId: 1} is equivalent to Body in Post
- pb.Response is the response to the HTTP request

With the following part of the code, dtm has the complete information and is able to launch the full call

`Add(busiServer+"/trans.TransSvc/TransOut", &busi.BusiReq{Amount: 30, UserId: 1})`

## A More Complete Example
An enthusiastic community member, Mikael, has helped to write a more informative example that mimic a real-world application. It make a complete demonstration of a distributed transaction actually running online:

- [https://github.com/Mikaelemmmm/gozerodtm](https://github.com/Mikaelemmmm/gozerodtm)
- [https://github.com/nivin-studio/go-zero-mall](https://github.com/nivin-studio/go-zero-mall)

::: tip Deployment In Docker
If you are using docker for your deployment, please do not use localhost/127.0.0.1 as host because they can not interoperating in docker.
:::
## Other ways to access
There are non-etcd alternatives to go-zero's microservices, we explain their access in order

#### Direct connection
For the direct connection, you can use the dtm configuration show above but just set the Target to an empty string.

In the case of a direct connection, there is no need to register the dtm to the registry

#### K8S
For K8S, you can use the dtm configuration show above but just set the Target to an empty string.

In K8S, the registration of services into K8S is done with deployment.yaml, and inside the application, no registration is required

## Summary

Welcome to use [dtm](https://github.com/dtm-labs/dtm) and give a star to support us.
