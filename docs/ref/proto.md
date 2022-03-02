# Overview

dtm supports a variety of protocols, including generic class protocols HTTP, gRPC, and microservice protocols such as go-zero.

## HTTP

HTTP as the most common protocol in front-end and back-end interaction, usually also used for back-end internal communication protocol.

When dtm server starts, it listens to port 36789 by default to provide HTTP service. It is recommended that you use the SDK [dtmcli](https://github.com/dtm-labs/dtmcli) for a minimalist example of using HTTP, see [dtmcli-go-sample](https://github.com/dtm-labs/dtmcli-go- sample)

For more advanced HTTP usage examples, please refer to the file with http under [dtm-examples](https://github.com/dtm-labs/dtm-examples)

If you are accessing a microservice protocol on top of HTTP, you may need to provide the relevant microservice as a standalone HTTP service yourself for now, dtm may later support a microservice protocol like SpringCloud

## gRPC

gRPC is widely used in back-end microservices, a lot of cloud-native applications, a lot of microservice frameworks, built on top of this protocol, very widely used

When dtm server starts, it listens to port 36790 by default to provide gRPC services. For users using dtm via gRPC protocol, we recommend you to use the SDK [dtmgrpc](https://github.com/dtm-labs/dtmgrpc), for a minimal example of using gRPC, please refer to [dtmgrpc-go-sample](https://github.com) /dtm-labs/dtmgrpc-go-sample)

For more advanced gRPC usage examples, please refer to the file with grpc under [dtm-examples](https://github.com/dtm-labs/dtm-examples)

## Microservice protocols

Currently there are many microservice frameworks that are widely used. In order to facilitate users to use dtm directly in their own microservice frameworks, dtm uses a plug-in approach to support multiple microservice frameworks on top of gRPC.

#### go-zero
dtm first support to go-zero, which is a very hot microservices framework as soon as it is open source.

See [go-zero](./gozero)

#### polaris
dtm has supported to Tencent's open source polaris and the microservices framework on top of polaris. During the developing, we got a lot of support from Tencent staff, and PR was provided by Tencent staff [ychensha](https://github.com/ychensha).

dtm supports grpc-polaris microservices framework natively from v1.6.3

The specific access guide is to be improved

#### Other
Other microservice framework protocols on top of gRPC are being supported quickly, if you have related needs or you are a framework maintainer, please contact me (WeChat yedf2008), we will be happy to support your microservice framework!

For details on how to get your microservice framework to dtm, please refer to the following microservice interface guide

## Microservices Support Guide

This document is mainly for framework maintainers, ordinary users do not need to pay attention to

dtm supports access to microservice frameworks on top of the gRPC protocol, i.e., microservice frameworks that use the gRPC Resolver mechanism, see below for an example of how to use a custom protocol

#### To run an example
dtm made a minimalist protocol example: protocol1, to facilitate access to the framework maintainer, follow the steps below to be able to run the application of this protocol.

- Configure the dtm server and run
```
MicroService:
  Driver: 'dtm-driver-protocol1'
```
- Run an app that uses dtm
```
# dtm-labs/dtmdriver-clients
go run protocol1/main.go
```

At this point you can see a log like this, and the simple protocol is up and running.
```
2021/12/03 15:27:13.65 types.go:43 grpc client called: protocol1://localhost:36790/dtmgimp.Dtm/NewGid result: Gid: "c0a803b8_4psHCRxQ1kA" err: <nil>
2021/12/03 15:27:13 TransOut 30 from user 1
2021/12/03 15:27:13 TransIn 30 to user 2
```

A more complete runtime example can be found in [go-zero](./gozero)

#### access steps

The access steps are as follows.
- Implement the interface inside dtm-labs/dtmdriver
- Submit a PR to dtm and import the package you have implemented in dtmdriver in dtm
- Configure the dtm server to use your driver
- Execute dtmdriver.Use, register your driver, and then you can use dtmgrpc

A complete example can be found here [dtmdriver-clients](https://github.com/dtm-labs/dtmdriver-clients)
#### Step 1: dtmdriver interface
This interface is defined as follows
``` go
// Driver interface to do service register and discover
type Driver interface {
	// GetName return the name of the driver
	GetName() string
	// RegisterGrpcResolver register the grpc resolver to handle custom scheme
	RegisterGrpcResolver()
	// RegisterGrpcService register dtm endpoint to target
	RegisterGrpcService(target string, endpoint string) error
	// ParseServerMethod parse the uri to server and method.
	// server will be passed to grpc.Dial, and method to grpc.ClientConn.invoke
	ParseServerMethod(uri string) (server string, method string, err error)
}
```

##### GetName
Returns the driver name of the microservice framework, usually prefixed with "dtm-driver-", e.g. "dtm-driver-gozero".

It will be used by dtm server and dtm client

##### RegisterGrpcResolver
You need to register your grpc's resolver in this function, so that when grpc calls it, it will use your service discovery

##### RegisterGrpcService
In your microservices framework, you may need to register the dtm service to your service discovery component. dtm service will call your function after it starts and pass the Target and Endpoint of the dtm configuration

##### ParseServerMethod
Due to the individual microservice frameworks, for the URL in the protocol, dtm needs to split it into two parts, server and method, and then create the connection and call it. However, different microservice protocols usually have different ways of splitting, so dtm server and SDK will call this interface to complete the splitting

##### init
After you have implemented Driver, please register your Driver with dtmdriver as follows:
``` go
func init() {
	dtmdriver.Register(&protocol1Driver{})
}
```
#### Step 2: Raise PR to DTM
If you have finished writing the driver, you can submit a PR to dtm and the dtm team will give you timely feedback and evaluate your requirements. The content of your PR is similar to.
``` go
import _ "github.com/dtm-labs/dtmdriver-gozero"
```

#### Step 3: Configure running dtm
Configure dtm to support your custom protocol, an example is as follows.
```
MicroService:
  Driver: 'dtm-driver-gozero' # Fill in your driver name
  Target: 'etcd://localhost:2379/dtmservice' # dtm service will be registered to this url
  EndPoint: 'localhost:36790' # ip port of dtm service
```

#### Step 4: Using the dtm SDK
dtm's grpc protocol SDK is dtmgrpc, you first call dtmdriver.Use("dtm-driver-gozero") to tell dtmgrpc to use this driver to parse the url.

Then you can use dtmgrpc to access dtm normally
