# SAGA

SAGA originally appeared in the paper [SAGAS](https://www.cs.cornell.edu/andru/cs711/2002fa/reading/sagas.pdf) published by Hector Garcia-Molina and Kenneth Salem in 1987. 
The key idea is to write a long-lived transaction as multiple short local transactions, collectively termed as a SAGA and coordinated by the SAGA transaction coordinator.
If all sub-transactions of a SAGA complete, the SAGA completes successfully.
If one sub-transaction fails, the compensating transactions will be invoked one at a time in the reverse order.

Suppose we want to perform an inter-bank transfer.
The operations of transfer out (TransOut) and transfer in (TransIn) are coded in separate micro-services.
A typical timing diagram for a successfully completed SAGA transaction would be as follows:

![saga_normal](../imgs/saga_normal.jpg)

## Simple SAGA

Let's complete one of the simplest SAGA:

### http

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

### grpc

``` go
req := dtmcli.MustMarshal(&TransReq{Amount: 30})
gid := dtmgrpc.MustGenGid(DtmGrpcServer)
saga := dtmgrpc.NewSaga(DtmGrpcServer, gid).
  Add(BusiGrpc+"/examples.Busi/TransOut", BusiGrpc+"/examples.Busi/TransOutRevert", req).
  Add(BusiGrpc+"/examples.Busi/TransIn", BusiGrpc+"/examples.Busi/TransOutRevert", req)
err := saga.Submit()
```

In the above code, a SAGA transaction is first created, and then two sub-transactions, TransOut and TransIn, are added.
Each of the two sub-transactions includes two branches, the forwarding action and the compensating action, given as the first and second arguments of the Add function, respectively.
After the sub-transactions are added, the SAGA is submitted to DTM. 
DTM receives the global SAGA transaction and runs the forward operations of all sub-transactions.
If all the forward operations complete successfully, the SAGA transaction completes successfully.

### Rollback upon failure 

If any forward operation fails, DTM invokes the corresponding compensating operation of each sub-transaction to roll back, after which the transaction is successfully rolled back.

Let's purposely fail the forward operation of the second sub-transaction and watch what happens

``` go
  Add(qsBusi+"/TransIn", qsBusi+"/TransInCompensate", &TransReq{Amount: 30, TransInResult: "FAILURE"})
```

The timing diagram for the intended failure is as follows:

![saga_rollback](../imgs/saga_rollback.jpg)

## Advanced SAGA

There is a lot of SAGA strategies inside the original paper, including two recovery strategies, as well as parallel SAGAs.
Our discussion above only addresses the simplest SAGA.

For advanced usage of SAGA, such as parallel SAGAs, DTM will add support in future.


