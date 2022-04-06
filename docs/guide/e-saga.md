# SAGA Example
This article will present a complete SAGA example to give the reader an accurate understanding of SAGA transactions

## Business Scenario
An inter-bank transfer is a typical distributed transaction scenario, where A needs to transfer money across a bank to B. Both the withdraw and the deposit may succeed of fail, and it is required that the sum of balance of A and B should not change after the transfer finished, regardless of any errors that occur.

## SAGA

Saga is a distributed transaction pattern mentioned in this paper [SAGAS](https://www.cs.cornell.edu/andru/cs711/2002fa/reading/sagas.pdf). The core idea is to split long transactions into multiple short local transactions, which are coordinated by the Saga transaction coordinator, so that if each local transaction completes successfully then it completes normally, and if anyone step fails then the compensating operations are invoked one at a time in reverse order.

## SAGA transaction

We will present you a detailed runable example base on [dtm](https://github.com/dtm-labs/dtm), a distributed transaction framework.

Suppose that you have finished your implementation of the business for transfering and rollback.
- "/api/SagaBTransOut"
- "/api/SagaBTransOutCom" compensation for TransOut
- "/api/SagaBTransIn"
- "/api/SagaBTransInCom" compensation for TransIn

The following code will orchestrate these operations to a Sagas distributed transaction. The transaction will finished when both `TransIn` and `TransOut` succeed, or both rolled back. In both cases, the sum of balance of A and B remains the same.

``` GO
	req := &gin.H{"amount": 30} // load of microservice
	// DtmServer is the address of the DTM service
	saga := dtmcli.NewSaga(DtmServer, dtmcli.MustGenGid(DtmServer)).
		// Add a child transaction of TransOut with url: qsBusi+"/TransOut" for the forward operation and url: qsBusi+"/TransOutCom" for the reverse operation
		Add(qsBusi+"/SagaBTransOut", qsBusi+"/SagaBTransOutCom", req).
		// Add a subtransaction of TransIn with url: qsBusi+"/TransOut" for the forward action and url: qsBusi+"/TransInCom" for the reverse action
		Add(qsBusi+"/SagaBTransIn", qsBusi+"/SagaBTransInCom", req)
	// commit saga transaction, dtm will complete all subtransactions or rollback all subtransactions
	err := saga.Submit()
```

A successful transaction timing diagram is as follows.
![saga_normal](../imgs/saga_normal.jpg)

## Core operations

The adjustment and compensation of user balance should be handled carefully. Here we dive into the detail of the adjustment. For the example of the bank transfer we are going to perform, we will do the `TransOut` and `TransIn` in the action operation and the opposite adjustment in the compensation operation.

First we create the account balance table.
``` Go
CREATE TABLE dtm_busi.`user_account` (
  `id` int(11) AUTO_INCREMENT PRIMARY KEY,
  `user_id` int(11) not NULL UNIQUE ,
  `balance` decimal(10,2) NOT NULL DEFAULT '0.00',
  `trading_balance` decimal(10,2) NOT NULL DEFAULT '0.00',
  `create_time` datetime DEFAULT now(),
  `update_time` datetime DEFAULT now()
);
```

Then write the core business code to adjust the user's account balance

``` Go
func SagaAdjustBalance(db dtmcli.DB, uid int, amount int, result string) error {
	_, err := dtmimp.DBExec(db, "update dtm_busi.user_account set balance = balance + ? where user_id = ?" , amount, uid)
	return err
}
```

Then write the specific processing function for the action/compensation operation

``` GO
app.POST(BusiAPI+"/SagaBTransIn", dtmutil.WrapHandler2(func(c *gin.Context) interface{} {
  barrier := MustBarrierFromGin(c)
  return barrier.Call(txGet(), func(tx *sql.Tx) error {
    return SagaAdjustBalance(tx, TransInUID, reqFrom(c).Amount, "")
  })
}))
app.POST(BusiAPI+"/SagaBTransInCom", dtmutil.WrapHandler2(func(c *gin.Context) interface{} {
  barrier := MustBarrierFromGin(c)
  return barrier.Call(txGet(), func(tx *sql.Tx) error {
    return SagaAdjustBalance(tx, TransInUID, -reqFrom(c).Amount, "")
  })
}))
app.POST(BusiAPI+"/SagaBTransOut", dtmutil.WrapHandler2(func(c *gin.Context) interface{} {
  barrier := MustBarrierFromGin(c)
  return barrier.Call(txGet(), func(tx *sql.Tx) error {
    return SagaAdjustBalance(tx, TransOutUID, -reqFrom(c).Amount, "")
  })
}))
app.POST(BusiAPI+"/SagaBTransOutCom", dtmutil.WrapHandler2(func(c *gin.Context) interface{} {
  barrier := MustBarrierFromGin(c)
  return barrier.Call(txGet(), func(tx *sql.Tx) error {
    return SagaAdjustBalance(tx, TransOutUID, reqFrom(c).Amount, "")
  })
}))
```

The core logic of these processing functions is to adjust the balance, for which the role of `barrier.Call` will be explained in detail later

## Run
Follow these steps to run a successful example.
1. Run dtm which manage the distributed transactions
``` bash
git clone https://github.com/dtm-labs/dtm && cd dtm
go run main.go
```

2. Run the example

``` bash
git clone https://github.com/dtm-labs/dtm-examples && cd dtm-examples
go run main.go http_saga_barrier
```

## Handling network exceptions

Suppose a transaction committed to dtm has a transient fault when an operation is invoked. dtm will retry the incomplete operation, which requires the subtransactions of the global transaction to be idempotent. dtm framework pioneered the sub-transaction barrier technique, providing the BranchBarrier tool class to help users handle idempotency easily. It provides a function `Call` that guarantees that the operation inside this function will be commited at most once:
``` go
func (bb *BranchBarrier) Call(tx *sql.Tx, busiCall BarrierBusiFunc) error
```

This BranchBarrier can automatically handle not only idempotency, but also null-compensation and hanging issues, see [exceptions and solutions](../practice/barrier) for details.

## Handling rollbacks

What happens if the bank is preparing to transfer the amount to user B and finds that user B's account is abnormal and returns a failure? We update the handler function so that the transfer operation returns a failure

``` go
app.POST(BusiAPI+"/SagaBTransIn", dtmutil.WrapHandler2(func(c *gin.Context) interface{} {
  return dtmcli.ErrFailure
}))
```

We give the timing diagram for the transaction failure interaction

![saga_rollback](../imgs/saga_rollback.jpg)

The action of TransIn branch did nothing and returned a failure. Will compensation of TransIn branch cause the reverse adjustment to go wrong?

Don't worry, the preceding sub-transaction barrier technique ensures that the TransIn failure is compensated as a null operation if error occurs before the commit, and  is compensated to do opposite adjustment if error occurs after the commit

You can change the TransIn that returns an error after commit.
``` Go
app.POST(BusiAPI+"/SagaBTransIn", dtmutil.WrapHandler2(func(c *gin.Context) interface{} {
  barrier := MustBarrierFromGin(c)
  barrier.Call(txGet(), func(tx *sql.Tx) error {
    return SagaAdjustBalance(tx, TransInUID, reqFrom(c).Amount, "")
  })
  return dtmcli.ErrFailure
}))
```
The final result balance will still be right, see [Exceptions and Solutions](../practice/barrier) for details.

## Summary

This article gives a complete SAGA transaction solution, a working SAGA, which you can use to solve your real problems with a few simple modifications to this example

A detail description of SAGA can be found here [SAGA](../practice/saga)