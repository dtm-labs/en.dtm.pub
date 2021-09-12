# How to choose a transaction model

## Feature comparison among different transaction models

- XA. 
  Using this model, users can develop following their original business logic, and only need to adapt in the outer layer.
  The disadvantage is that the data lock takes a very long time, leading to poor concurrency.

- TCC.
  Using this model, users need to provide Try/Confirm/Cancel.
  There is no data lock, allowing high concurrency.
  Furthermore, nested sub-transactions is supported.

- SAGA.
  Using this model, users need to provide action/compensation.
  There is no data lock, allowing high concurrency. 
  Furthermore, all transaction states are stored on the server, which means application crashes do not lead to rollback.

- Transactional Message.
  Using this model, users do not need to write compensation operations, but need to provide a check interface.

## Typical scenario

- Suppose you have a promotion page where people can receive membership of a month and also a coupon.
  In this situation, receiving the membership and the coupon will not fail.
  It is suitable to use a simplified version of the Transaction Message model.
  All you need to do is to define the message that contains receiving the membership and the coupon.
  Then, submit without calling Prepare.

- Suppose you have a registration service that gives membership of one month and also a coupon to the newly-registered user.
  For this situation, it is suitable to use the Transaction Message model.
  In the user registration transaction, define the message that contains the membership and coupon collection.
  Prepare and, after the transaction is committed, call Submit.

- Suppose you have a distributed transaction that needs to call a bank transfer interface, and suppose the interface will take a long time.
  For this situation, it is suitable to use the SAGA model.
  Because the whole process takes a long time, it is suitable to store the states of all the steps of the whole transaction in the server side, which means application crashes do not lead to rollback.

- Suppose you have an order-related business that invokes different sub-transactions based on item information, where nesting may occur. 
  For this situation, it is suitable to use the TCC model, because the application has the most flexible control over TCC and nested sub-transaction is supported.

- If your business does not require high concurrency, it is fine to use the XA model.

