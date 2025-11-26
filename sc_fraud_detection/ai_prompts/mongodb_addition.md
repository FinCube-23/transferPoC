Currently we are not persisting the Result anywhere.
So, next i want to do that.

After Generating the result i want to save some info in db.
The info i want save are:
1. user_ref_number
2. score(based on this we will determine if a user can make a tx or not.)=default:0 , this will always be between 0-1. for every fraud tx a value will be added(value will depend on confidance.) and not fraud tx a value will be subtrack(value will depend on confidance)


There will be a api endpoint to get score by ref number.

- DB: MongoDB(in docker)