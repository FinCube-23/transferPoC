I want to build an RAG service which can determine if an account is fraud or not.

My initial plan is:
1. I will keep this (https://www.kaggle.com/datasets/vagifa/ethereum-frauddetection-dataset) dataset in a vector db.
2. This service will rerecive an acc address and then depending on the dataset saved in vector db it will determine if thte accout is fraud or not(True or False or None(not determine)).
3. For the determiniation it will use the below alchemy api endpoint to get the account info.


4. After getting the data using these alchemy api endpoints , I will use K-NN to dertermine the possibility fraud account. I will do this comparison by using the data stored in vector-db.
Then I want to use gemini model for furter perfection and handle response and unconventional pattern that are not available in the vector-db.



## Stack & Masc.
1. FastAPI.
2. Langchain,Langgraph,Using proper guardrail
3. Vector db: OpenSearch.
4. Gemini model
5. Alchemy API to get data.
6. We will use docker image of db and other things that we may need.

