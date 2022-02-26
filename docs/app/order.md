# Order system
DTM can be applied to the order system, which can greatly simplify the framework of the order system, as described in detail below

## Existing issues
Most order systems have been service-oriented, splitting the order system into items including order services, inventory services, coupon services, payment services and account services. In the whole order processing process, there are many operations (such as creating orders and deducting inventory) that need to ensure atomicity, but in the distributed system, a lot of problems have to be solved to ensure that. Let's discuss one of the typical problems in detail and gradually give a better framework.

Scene: when the current user submits an order, the server needs to complete the following operations:
- Create the order: you need to create an order in the order list, and the unique key is the order ID
- Deduct the inventory: you need to deduct inventory for goods that are placed an order by users
- Deduct the coupon: the user selects the available coupons before placing an order, and the coupons are deducted when submitting the order
- Create a payment document: after submitting an order, you need to create a payment document and tell the user to jump to the payment page

For the above scenes, if in a single order system, it is easy to use database transaction to solve. However, once the service is realized, the problems in the distributed system need to be considered, and we will gradually analyze the problems and give solutions.

#### Process crash problem
In the order API, we call: create the order -> deduct the inventory -> deduct the coupon -> create a payment document, but in this process, process crash may occur, leading several steps above uncompleted.

This is a common problem, and it's common as long as the order volume gets larger. There are several treatment schemes:
- Allow inconsistencies: those small companies may allow such inconsistent data. If customer service receives such feedback, or monitors such occurrence, the developer handles it;
- Message queue is guaranteed to succeed at least once: In order to avoid the above inconsistencies, you can put each operation in the order into the message queue. When the process crash occurs, then the relevant messages are still in the queue and will be consumed again to ensure at least one success, but it cannot guarantee that there is a queue and only once, so the relevant operations must be idempotent. Detailed in later sections.
- State machine: many large factories define each state of the order and the state flow of each operation by implementing a complex state machine. This scheme is very complicated. Most small and medium-sized companies do not have such a strong R & D force

#### Idempotent
Once in a distributed system, there is a certain probability of repeated requests. For example, the previous message queue scheme is guaranteed to be consumed successfully at least once, but may be consumed multiple times, repeated requests will be resulted. In addition, in the field of micro-services, in order to prevent the temporary failure of the network and the failure of the request, retry policies are often configured.

Suppose that in such a scene, the process crashes after the database transaction with inventory deduction is committed, then the result of this request is unknown, and a retry will be made according to the scene described earlier. When processing a repeated request, the inventory service needs to determine that this is a repeated request and cannot deduct the inventory any more, then directly return to successfully deduct.

Other operations such as deducting coupons and creating payment orders also need idempotent processing. Although this kind of processing is not difficult, it still has a lot of workload and is not easy to reproduce all abnormal situations. Therefore, when repeated requests occur online, problems will easily occur and developers have to spend a lot of time

#### About Rollback
If there is a problem with one of the multiple steps of the order, such as insufficient inventory, or if the user places an order at both terminals at the same time, the coupon in one order will not be deducted, and a rollback is required. Once you're dealing with Rollback, you'll find that the order system is very difficult to implement. If the message queue is adopted, a rollback compensation message will be inserted into the message queue, and the processing of the compensation message will be very complicated, so you need to judge the progress and then perform the compensation; If a state machine is used, such rollback operations will also add a lot of states to the machine, making the system more complex

#### Precise compensation
When compensations need to be carried out in the business, it also becomes a very difficult problem and where is the point? Let's consider the issue of inventory deductions. If the inventory service receives a request for an inventory deduction and processes it, then the local transaction may have been committed, or it may fail because of the process crash. At this time, if the request for rolling back the inventory is received again, it is necessary to identify whether the inventory has been modified, and compensation modification is required for the modified inventory; for those not modified, ignore.

This compensation problem exists in both the message queue scheme and the state machine scheme, and it will cost a lot of time for developer to make each resource properly handled.

## DTM solution
In terms of the above problems, DTM pioneered the minimalist scheme, who's code can be found in [dtm-cases/order](https://github.com/dtm-labs/dtm-cases/tree/main/order):

Let's take a look at it and see how it solves the problem we raised earlier. First, let's look at the main processing of the order API:

``` go
app.POST("/api/busi/submitOrder", common.WrapHandler(func(c *gin.Context) interface{} {
  req := common.MustGetReq(c)
  saga := dtmcli.NewSaga(conf.DtmServer, "gid-"+req.OrderID).
    Add(conf.BusiUrl+"/orderCreate", conf.BusiUrl+"/orderCreateRevert", &req).
    Add(conf.BusiUrl+"/stockDeduct", conf.BusiUrl+"/stockDeductRevert", &req).
    Add(conf.BusiUrl+"/couponUse", conf.BusiUrl+"couponUseRevert", &req).
    Add(conf.BusiUrl+"/payCreate", conf.BusiUrl+"/payCreateRevert", &req)
  return saga.Submit()
}))
```

In this code, a saga transaction is defined that contains the four steps required in the order process described above, as well as the compensation operations required for the four steps.
- **Process crash problem** During a saga transaction for DTM, if process crashes, DTM will retry to ensure that the operation will finally complete
- **Rollback problem** In this saga transaction, if insufficient inventory is found during inventory deduction, return to failure and rollback is performed. DTM records which operations have completed and rolls back the related operations

Then we select the code for Deduct the Inventory and Roll Back Inventory for further analysis:
``` go
app.POST("/api/busi/stockDeduct", common.WrapHandler(func(c *gin.Context) interface{} {
  req := common.MustGetReq(c)
  return common.MustBarrierFrom(c).CallWithDB(common.DBGet(), func(tx *sql.Tx) error {
    affected, err := dtmimp.DBExec(tx,
      "update busi.stock set stock=stock-?, update_time=now() where product_id=? and stock >= ?",
      req.ProductCount, req.ProductID, req.ProductCount)
    if err == nil && affected == 0 {
      return dtmcli.ErrFailure // not enough stock, return Failure to rollback
    }
    return err
  })
}))
app.POST("/api/busi/stockDeductRevert", common.WrapHandler(func(c *gin.Context) interface{} {
  req := common.MustGetReq(c)
  return common.MustBarrierFrom(c).CallWithDB(common.DBGet(), func(tx *sql.Tx) error {
    _, err := dtmimp.DBExec(tx,
      "update busi.stock set stock=stock+?, update_time=now() where product_id=?",
      req.ProductCount, req.ProductID)
    return err
  })
}))
```


In the above codes, the core business logic is to deduct inventory and roll back inventory, so how to deal with idempotent and precisely deduct the inventory? The core is on the following line of code:
``` go
  common.MustBarrierFrom(c).CallWithDB(common.DBGet(), func(tx *sql.Tx) error { /* ... */ })
```

When we put the operation of the database inside the above codes, we can automatically handle these:
- **Idempotent:** Operations in repeated requests will be filtered by the above code, and database operations will be called only in non-repeated requests
- **null compensation:** if no relevant database operation is submitted in stockDeduct, the database operation in stockDeductRevert will be filtered by the above code
- **Hang:** the above code handles not only Idempotent and Precise compensation issues, but also Hang requests

The above code uses the sub-transaction barrier technology pioneered by DTM. For details, please refer to the [sub-transaction barrier technology](../practice/barrier.html)

## Example source code
Detailed source code can be found in [dtm-cases/order](https://github.com/dtm-labs/dtm-cases/tree/main/order)

In this project, you can easily experiment with all the contents of this article

## Summary
A non-single order system takes a lot of time to deal with new problems in distributed systems, while DTM is a professional solution that provides a very nice and easy-to-use solution that can greatly simplify the archtechture compared to existing message queue or state machine.

It is hoped that through the analysis of this article and the simple and nice project code, you can quickly understand DTM, change the old understanding of "distributed transactions should not be used", and pass over all the related logic of distributed transactions to DTM to handle, so that we can pay attention to the business itself, and only need to write the related operations and compensation operations at ease.
