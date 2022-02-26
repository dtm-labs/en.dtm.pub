## How to choose a transaction mode

## Feature Comparison

- 2-phase message mode: Suitable for scenarios that do not require rollback
- saga mode: Suitable for scenarios that require rollback
- tcc transaction mode: suitable for scenarios with high consistency requirements
- xa transaction mode: suitable for scenarios with low concurrency requirements and no database row lock contention

## Application Scenarios

- flash-sales scenario: When the number of flash-sale visits is high, most systems choose to deduct inventory in redis and create orders after successful deduction. There is no rollback in this scenario, which is suitable for 2-pahase messages. 2-phase messages also ensure that in case of a process crash, the amount of inventory deducted is exactly equal to the amount of orders created, see [flash sales](../app/flash) for details
- Cache management scenario: It is a very common scenario to use redis cache to provide data and reduce the pressure on the database. Usually, the DB will be updated first, and the cache will be updated afterwards, no rollback is involved, and it is suitable for 2-phase messages. See [cache application](../app/cache) for details.
- order scenario: Suppose you have an order business that needs to ensure that your order creation, inventory deduction, and coupon deduction are successful or fail at the same time. Then it is suitable for Saga because Saga can support rollback and is the easiest to use of the distributed transactions. For details, see [order application](../app/order)
- Suppose you have a business like fund transfer, which requires high consistency and does not allow users to see the intermediate balance changes in case of transfer failure, this case is suitable for TCC, which can flexibly control the data visibility of the whole global transaction. See [TCC transactions](https://segmentfault.com/a/1190000040331793/en) for details
- Assuming that your business, which does not require high concurrency and does not have multiple requests competing for the same row of data (e.g., not deducting the same item inventory), then XA can be used.
