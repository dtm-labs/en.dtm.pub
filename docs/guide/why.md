# Why to choose dtm

## Real world problems

The dtm project originated from a problem in a real project.
In our company, services involving order payments put all business-related logic into one big local transaction, which leads to significant coupling and a huge increase in complexity.

In the middle of code refactor into microservice-based architecture using Go, we needed to split the original transaction into several distributed transactions.
After researching available open source distributed transaction solutions, we found that the only mature solution is Java-based.
Neither Go nor other languages have mature distributed transaction solutions.
This left us two choices:

- The first choice is to switch completely to Java, and then use seata, the most popular solution in Java applications.
  This solution is too costly since it requires a lot of the original business to be rewritten in Java.

- The second choice is to develop our own distributed transaction manager.
  In this way, we would be able to keep existing business developed in Go, and move to microservice-based architecture progressively.

## Capability of dtm

After carefully evaluating the second option, we found that our own distributed transaction manager, dtm, is significantly better than the first one in the following ways:

- dtm provides a very simple and easy-to-use interface for splitting specific business services into distributed transactions, which allows developers with a few years of development experience to adopt quickly

- dtm supports multi-language stacks, a feature of great importance to small companies in the middle of switching language stacks, and to large companies already adopting multi-language stacks

- sub-transaction barrier, our core technology, greatly reduces the difficulty of developers to deal with sub-transaction disorder.
  Note that implementation of similar technology on seata would be very difficult, while our own solution is much simpler.

## Open Source

In summary, in the three important aspects of development, namely simplicity and easiness to use, multi-language support, and reduction of business burden, our dtm solution is very good and stands out compared to other solutions we researched.
This is the reason why we decided to develop our own distributed transaction solution.
Comparison between dtm can seata can be seen here [DTM vs SEATA](../other/opensource).

Since our experience in practice shows that dtm is really excellent, can greatly reduce the threshold of using distributed transactions, and can solve many problems that cannot be solved in the market, we open source it to feed the open source community.
