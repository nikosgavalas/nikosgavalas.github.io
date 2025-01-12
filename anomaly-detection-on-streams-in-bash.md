Let's assume that we have a stream of data points, and we want to detect outliers i.e. points that deviate from the norm. This is interesting because usually such data are linked to faulty or malicious behavior.

The fact that our data points are available as a stream means that we cannot "look" at them more than once. Therefore we need an algorithm with complexity linear to the number of points of the stream.

In this article, we'll build an algorithm for this task and apply it to detect anomalous behavior in the KDD Cup '99 dataset which contains data from network connections to build a *network intrusion detector*.

We will model our data using a simple Gaussian-distribution model.

I thought it would be fun to implement it in one line of Bash. It turned out that squeezing everything in a huge line is not so fun, so I expanded it in a few more lines 🙃.

### Gaussian model to detect anomalies

Without further ado, let's begin with some theory. We start by assuming that our data are following the Gaussian distribution.

Therefore, given an instance $` x \sim \mathcal{N}(\mu, \Sigma), x \in \mathbb{R}^d, x=[x_1, x_2, \ldots, x_d]^T `$, its probability density function is:

```math
p(x; \mu, \Sigma)= \frac{1}{(2\pi)^{d/2}|\Sigma|^{\frac{1}{2}}}\exp\bigg(-\frac{1}{2}(x-\mu)^T\Sigma^{-1}(x-\mu)\bigg)
```

where $`\mu \in \mathbb{R}^d`$ is the mean and $` \Sigma \in \mathbb{R}^{d \times d} `$ is the
covariance matrix.

Now assuming that variables $` x_i \sim \mathcal{N}(\mu_i, \sigma_i^{2}) `$ are all independent, we get:

```math
p(x) = p(x_1, x_2, \ldots, x_d) = p(x_1; \mu_1, \sigma_1^2)p(x_2; \mu_2, \sigma_2^2)\ldots p(x_d; \mu_d,  \sigma_d^2) = \prod\_{j=1}^{d} p(x_j; \mu_j, \sigma_j^2)
```

where:

```math
p(x; \mu, \sigma^2)=\frac{1}{\sqrt{2\pi}\sigma} \exp\Big(- \frac{(x-\mu)^2}{2\sigma^2}\Big)
```

To train the model (which basically consists of the values $` \mu_i, \sigma_i^2, \forall i \in [1, \ldots, d] `$), one needs to calculate the following
parameters (MLE):

- $` \mu_i = \frac{1}{n} \sum\_{j=1}^{n}{x_i^{(j)}} `$, where $` n `$ is the number of training examples (the size of the training dataset),
- $` \sigma_i^2 = \frac{1}{n}{\sum\_{j=1}^{n}{(x_i^{(j)} - \mu_i)^2}} `$

Then, in the evaluation phase, given a new example $` x `$, we compute:

```math
p(x) = \prod\_{i=1}^{d}{ \frac{1}{\sqrt{2\pi}\sigma_i} \exp\Big(- \frac{(x_i-\mu_i)^2}{2\sigma_i^2}\Big) }
```

and we flag $`x`$ as anomaly if the value of $` p(x) `$ is smaller than a threshold value $`\epsilon`$ (hyperparameter).

Now here is the **imporant part**. How will we compute these values incrementally?

By having the tuples $` T_i = \big( \sum\_{j=1}^{n}{x_i^{(j)}}, ~ \sum\_{j=1}^{n}{{(x_i^{(j)})}^2}, ~ n \big) `$, where $` n `$ is the count of the instances, 
available at any point of the computation!
This way, when training or evaluating, in batch or on stream, we have access to all parameters of the model $` \mu_i `$ and
$` \sigma_i^2 `$ at any time by calculating:

```math
\mu_i = \frac{\sum\_{j=1}^{n}{x_i^{(j)}}}{n} = \frac{T_i[0]}{T_i[2]}, ~~~~~
\sigma_i^2 = \frac{\sum\_{j=1}^{n}{{(x_i^{(j)})}^2}}{n} - \mu_i^2 = \frac{T_i[1]}{T_i[2]} - (\frac{T_i[0]}{T_i[2]})^2
```

So let's go ahead and fetch the dataset, then implement the algorithm with awk.

### Fetch and prepare the dataset

The dataset is available [here](http://kdd.ics.uci.edu/databases/kddcup99/kddcup99.html). I will be using the 10 percent version, and only the HTTP protocol.

We'll use curl for the GET request, pipe it into zcat (because it is gzipped), and then use awk to keep only the HTTP rows, and filter out most features,
keeping only the 4 most important columns: `duration`, `src_bytes` and `dst_bytes`, plus the `label`. We also edit the label to be `1` in case of
anomaly, or `0`, in case of normal observation.

```bash
URL=http://kdd.ics.uci.edu/databases/kddcup99/kddcup.data_10_percent.gz # 10 percent
OUTFILE=http.csv

curl $URL | zcat | awk 'BEGIN{ FS=","; OFS="," } { LABEL=($NF=="normal." ? 0 : 1); if($3 == "http") print $1, $5, $6, LABEL }' > $OUTFILE
```

So now our dataset with 64293 rows is in the http.csv file.

### Implementation

We'll put our code in a file called `gauss.awk`. Start by defining some variables:

```bash
BEGIN {
    FS = ",";

    # < NF to ignore the last column (label)
    for (i = 1; i < NF; i++) {
        SUMS[i] = 0;
        SQUARES[i] = 0;
    }
}
```

`FS` is a special variable used by awk, denoting the input field separator. Since we have a csv, we use commas.
`SUMS` and `SQUARES` are two arrays, with the one holding the cumulative sum of the values of each feature, and the other
holding the cumulative sum of the squares of these values.

Next we move on to the main awk loop, and write the code which will apply to every row of the input file.

Here we will first update the model, by updating the `SUMS` and `SQUARES` arrays. For each feature (or column, call it
however you like), we update the respective value using the current row that awk is parsing.

After that, we use the current row and the model (the arrays), to calculate an anomaly score, according to the formula
we discussed earlier (see $` p(x) `$). To get an accurate value of $` \pi `$ for the calculations, I am using `atan2(0, -1)`.

```bash
{
    # Update the model
    for (i = 1; i < NF; i++) {
        SUMS[i] += $i;
        SQUARES[i] += $i ** 2;
    }

    # Calculate score using the model
    score = 1;
    for (i = 1; i < NF; i++) {
        mu = SUMS[i] / NR;
        sigma2 = (SQUARES[i] / NR) - mu ** 2;
        if (sigma2 == 0)
            score = 0;
        else {
            score *= exp(- (($i - mu) ** 2) / (2 * sigma2)) / sqrt(2 * atan2(0, -1) * sigma2);
        }
    }

    # Output the score
    print score, $NF
}
```

Finally, we output the score, along with the actual label.

Now let's run this:

```bash
$ awk -f gauss.awk http.csv
...
2.01308e-12 0
2.02266e-12 0
2.04232e-12 0
2.04342e-12 0
2.0474e-12 0
2.02895e-12 0
2.0324e-12 0
2.03025e-12 0
```

Looks good. Some warnings on stderr about the `exp()` function are normal, it is because some arguments passed in `exp` are `< -745` and
therefore return incredibly small values but awk handles them as `0` so we're good.

Now I want to calculate the ROC AUC score, and for that, I will be using a simple python script with the `numpy` module,
and the `roc_auc_score` function from the `scikit-learn` module:

```python
import numpy as np
from sklearn.metrics import roc_auc_score
from sys import stdin

preds = []
actuals = []

for line in stdin:
    s = line.split(' ')
    preds.append(-float(s[0]))
    actuals.append(int(s[1]))

preds_arr = np.array(preds)
actuals_arr = np.array(actuals)

print(roc_auc_score(actuals_arr, preds_arr))
```

Now I can pipe the output of awk into the script, which I'll call `auroc.py`, like this:

```bash
$ awk -f gauss.awk  http.csv | python3 auroc.py
```

, and this prints the score, which is `0.9762313543238387`, a pretty good value.

Last but not least, we can even choose a threshold and start flagging the values. This is what an anomaly detector actually does. What's the
intuition behind this? Since the scores are nothing more than the probability of the observation in the Gaussian distribution (the model),
we will be flagging the value as anomaly, if this score is lower than a particular threshold, meaning that it is having a low probability
of occurring.

A good threshold here could be `9.83056225277626e-15` (found with some interpolation), so we can just change the last lines of the script to:

```bash
if (score < 9.83056225277626e-15)
    print 1, $NF
else
    print 0, $NF
```

, so that it prints `1` if the score is lower than the threshold, or `0` if is not, along with the actual label. You can now calculate the F1 score if
you want with some `grep`s of the output.

### Putting it all together

Now let's glue everything together in one line:

```bash
$ curl -s $URL | zcat | awk 'BEGIN{ FS=","; OFS="," } { LABEL=($NF=="normal." ? 0 : 1); if($3 == "http") print $1, $5, $6, LABEL }' | awk -f gauss.awk 2> /dev/null | python3 auroc.py
0.9762313543238387
```

I got rid of the `http.csv` file and piped the output of the first awk directly into the second one, and I also redirected the stderr of the second awk to `/dev/null` to silence the warnings, so that we can get a clean output in the terminal.

So there you go, one pass on the data with a few lines of awk are enough to handle many cases of spotting outliers in datasets.

### Sidenote: Big Data Frameworks

This algorithm can be implemented in any Big Data framework (Apache Spark, Hadoop, Flink, whatever...) in a very straightforward way, with the functional
operators `map` and `reduce`. Assume that our training data are $` n `$ d-dimensional
vectors $` x^{(j)} = [x_1^{(j)}, x_2^{(j)}, \ldots, x_d^{(j)}]^T, j \in [1, \ldots, n] `$. 
Then the values of vectors $` \mu `$ and $` \sigma^2 `$ can be computed by:

```scala
// Scala
dataSet
  .map { x => (x, pow(x, 2), 1) }
  .reduce { (x1, x2) => (x1._1 + x2._1, x1._2 + x2._2, x1._3 + x2._3) }
  .collect()
```
