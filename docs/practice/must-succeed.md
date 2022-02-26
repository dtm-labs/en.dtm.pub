# Eventual success
What is the meaning of the requirement of eventual success of the operation that appears in multiple transaction modes in dtm? Which scenarios are eventual success? Why is eventual success required? How to disign the application?

Eventual success does not mean that 100% success is guaranteed, it allows for temporary failures: including network failures, system downtime, system bugs; but once the temporary problems are resolved, success needs to be returned after the business is restored.

Another way of saying eventual success is that the operation can eventually succeed, i.e., it will eventually return success by continuously retrying.

## Eventual success scenarios
eventual success scenarios include the following
- Branch operations in messages
- Compensation operations in SAGA
- Confirm and Cancel operations in TCC

Your business needs to ensure that the above operations are eventually successful in terms of business logic.

## Why eventual success

Suppose your business uses SAGA and then the following scenarios occur in sequence.
- An operation fails and needs to be rolled back
- In the process of rolling back, you encounter a rollback failure
- The SAGA transaction can neither be executed forward nor rolled back

This is due to a problem in the logical design of your business system that the distributed transaction can not solve, so your business needs to ensure that the rollback is eventually successful.

## How to design the application
- The branch operation of the message is eventually successful because the message does not support rollback. If you need rollback, then use another transaction model

- SAGA transaction if some forward operations are not rollbackable, then you can use a normal non-concurrent SAGA with the rollbackable branch Ri in front and the non-rollbackable branch Ni in the back. If the branch Ri forward operation fails, it will roll back Ri, and once it gets to Ni, the forward operation of Ni is guaranteed to eventually succeed, which also ensures that the SAGA transaction runs successfully.

- The Confirm/Cancel of the TCC transaction is eventually successful. The general design is to reserve resources in the Try phase of TCC, check the constraints, and then modify the data in the Confirm phase and release the reserved resources in the Cancel phase. After careful design, it can guarantee the eventual success of Confirm/Cancel in business logic

## Points to note
In actual business applications, certain application bugs may occur, resulting in operations that require eventual success, never succeeding, resulting in data never reaching eventual consistency. It is recommended that developers monitor the global transaction table and find transactions with more than 3 retries, issue an alarm, and have the Ops staff to push a developer to handle it manually, see [dtm's Ops](../deploy/maintain)

