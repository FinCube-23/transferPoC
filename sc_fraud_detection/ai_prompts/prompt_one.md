You Are an Senior SWE who is assinged with the task described in ./service_overview.md.

now do the following to implement the task in hand:



as a vector db i will be using OpenSearch docker image.
and this whole service will use fastapi and will be dockerize.

1. first give me an scrapper which when ran will scrape data from the kraggle dataset(https://www.kaggle.com/datasets/vagifa/ethereum-frauddetection-dataset) and insert in the vector db(make the scrapper such that it can scrape from any given link like the kraggle I have given, as data source will change in the future).

2. there will be an POST route "/scrore" which will have the address of the account that i want to verify, wheather it's fraud or not.

3. then by comparing the account data(that we have gotten from alchemy) and the dataset stored in our vector db we will compare them using the k-nn algo.

4. then we will give the result to gemini for further perfection.

5. we will implement the RAG(gemini) feature with Langchain,Langgraph, as these will give us more control over what we do and we also need to use proper guard rails for furter perfection. Main reason of using rag , is to handle the edge cases that maybe ignored by the k-nn algo. So, make sure we are doing proper utilization of the RAG.

6. After doing these we will return the necessary data in json format.
the format in my mind:
{
    "result":"True|False|Undecided"
    .....
}
feel free to change/add necessary info.

## Keep in mind
1. the data in db maybe large in size , so keep that in mind for query optimizaiton.