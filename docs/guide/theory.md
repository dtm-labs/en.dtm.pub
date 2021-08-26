With the rapid development of business and increasing business complexity, almost every company's system will move from the monolithic architecture to a distributed, especially microservice-based one. 
Naturally with this change comes the challenging difficulty of distributed transactions.
Our DTM is committed to providing an easy-to-use, language-agnostic, high-performance and scalable distributed transaction solution.

## Basic theory

Before explaining the our DTM solution, let's review some basic theoretical knowledge necessary for distributed transactions.

Let's take a money transfer as an example: A wants to transfer $100 to B.
What needs to be done is thus to subtract $100 from A's balance and to add $100 to B's balance.
The guarantee must be provided that the entire transfer, namely A-$100 and B+$100, either succeeds or fails atomically as a whole. 
Let's see how this problem is solved in various scenarios.

## Transactions

The functionality to execute multiple statements as a whole is known as a database transaction.
A database transaction ensures that all operations within the scope of that transaction either all succeed or all fail.

Transactions have four properties: atomicity, consistency, isolation, and persistence. 
These four properties are commonly referred to as ACID characteristics.

- Atomicity: All operations in a transaction either complete or do not complete, but never end at some point in the middle.
  A transaction that meets an error during execution is rolled back so that the system is restored to the state it was in before the transaction began, as if the transaction had never been executed.

- Consistency: The integrity of the database is not broken before the transaction starts and after the transaction ends.
  Integrity including foreign key constraints, application-defined constraints, etc, will not be broken.

- Isolation: The database allows multiple concurrent transactions to read, write and modify its data at the same time.
  Isolation prevents data inconsistencies due to cross-execution when multiple transactions are executed concurrently.

- Persistence: After the transaction is finished, the modification of the data is permanent and will not be lost even if the system fails.

## Distributed theory

A distributed system can only satisfy at most two of the three criteria of Consistency, Availability, and Partition tolerance at the same time. 
This is called CAP theory and has been proven.

### C Consistency

In distributed systems, data is usually stored in copies on different nodes. 
If an update operation has been successfully executed on the data on the first node, but the data on the second node is not yet updated accordingly, then the data read from the second node will be the data before the update, i.e., dirty data, which is the case of data inconsistency in distributed systems.

In a distributed system, if it is possible to achieve that all users can read the latest value after a successful execution of an update operation on a data item, then the system is considered to have strong consistency (or strict consistency).

Please note that the consistency in CAP and the consistency in ACID, although with the same wording, have different meanings in practice.
Please pay attention to the differences.

### A Availability

Availability means whether the cluster as a whole can still respond to client read and write requests after a failure of some of the nodes in the cluster. (High availability for data updates)

In modern Internet applications, it is unacceptable if the service is unavailable for a long time due to problems such as server downtime.

### P Partitioning tolerance

In practical terms, partitioning is equivalent to a time limit on communication. 
If a system cannot achieve data consistency within the time limit, partitioning occurs and a choice must be made between Consistency and Availability concerning the current operation.

A way to improve partitioning tolerance is to duplicate a data item to multiple nodes, then after partitioning occurs, this data item can still be read in other partitions and tolerance is improved. 
However, duplicating data to multiple nodes introduces consistency issues, in that the data on different nodes may be inconsistent.

## Problems faced

For most scenarios of large Internet applications, there are many hosts deployed in a decentralized fashion.
Clusters are now getting larger and larger, so node failures and network failures are normal.
The importance to ensure service availability up to N nines means that P and A have higher priorities over C.

If you want to study CAP-related theories in depth, it is recommended to study the raft protocol (PS: Here is a recommended animation to explain the raft protocol: [raft animation](http://www.kailing.pub/raft/index.html)). 
Through learning raft, you will be able to understand better the problems faced in distributed systems and the typical solutions.

## BASE theory

BASE is a shorthand for the three phrases Basically Available, Soft state, and Eventually consistent. 
BASE results from a trade-off between consistency and availability in CAP, and is based on the conclusions of distributed practice for large-scale Internet systems and derived from the CAP theory.
The core idea is that even though strong consistency cannot be achieved, each application can adopt an appropriate approach, according to its business characteristics, to make the system achieve Eventual consistency.
Next, we will focus on the three elements of BASE in detail.

- Basic availability means that a distributed system is allowed to lose partial availability in the event of an unpredictable failure - but note that this is in no way equivalent to the system being unavailable.

- Weak state, also known as soft state, as opposed to hard state, is the principle of allowing an intermediate state of data in the system and assuming that the existence of that intermediate state does not affect the overall availability of the system, i.e., allowing the system to have a delay in synchronizing data between copies of data on different nodes.

- Final consistency emphasizes that all data copies in the distributed system, after a period of synchronization, can eventually reach a consistent state. 
  Therefore, the essence of final consistency is that the system needs to ensure that the final data can reach a consistent state, rather than the strong consistency of the system data in real time.

In summary, BASE theory aims at large, highly available and scalable distributed systems, and is the opposite of the traditional ACID feature of transactions. 
It is completely different from the strong consistency model of ACID, but proposes to obtain availability by sacrificing strong consistency, and allows data to be inconsistent for a period of time, but eventually reach a consistent state.
Nevertheless, in practical distributed scenarios, different business units and components have different requirements for data consistency, so the ACID feature and BASE theory are often used together in the design process of specific distributed system architectures.

## Distributed transactions

A typical distributed transaction scenario is the inter-bank money transfer.
Suppose A needs to transfer money to B across banks.
The scenario involves data from two banks, thus the ACID of the transfer cannot be guaranteed by a local transaction in one database, but only be solved by a distributed transaction.

A distributed transaction means that the transaction initiator, the resource and resource manager and the transaction coordinator are located on different nodes of the distributed system.
In the above inter-bank transfer senarior, the A-$100 operation and the B+$100 operation are not located on the same node.
In essence, distributed transactions aims to ensure the correct execution of data operations in a distributed scenario.

On one hand, distributed transactions follow the BASE theory in a distributed environment in order to meet the needs of availability, performance and degraded services, while reducing the requirements of consistency and isolation:

- Basic Availability
- Soft state
- Eventual consistency

On the other hand, distributed transactions also partially follow the ACID specification.

- Atomicity: strict compliance
- Consistency: Consistency after the transaction is completed is strictly followed; consistency in the transaction can be relaxed appropriately
- Isolation: no influence between parallel transactions; visibility of intermediate results of transactions is allowed to be relaxed in a safe manner
- Persistence: Strictly followed

## Summary

After reviewing the above theoretical knowledge, let's solve actual distributed transaction problems using dtm.

