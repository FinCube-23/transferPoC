currently in my @@@sc_fraud_detection what i am doing is i am getting an wallet address,then i am querying the data related to that wallet address from alchemy then using that data i am determining the result(with knn and rag)

but as you can see in my @@@web3/contracts/fincube.sol contract which emit the event
```
emit StablecoinTransfer(
            sender_reference_number,
            receiver_reference_number,
            memo,
            msg.sender,
            to,
            memo,
            amount,
            nullifier
        );
```

so, now what i want to do is:
my api endpoint /scrore will now receive 2 arguments in body
{
    address(can one of msg.sender or to and these are just wallet address),
    reference_number(same like address)
}


you can also see in @@@fincube.sol how the reference number is being generated
```
referenceNumber = keccak256(
            abi.encodePacked(emailHash, orgReferenceKey, REFERENCE_SALT)
        );
```


so, for my latest workflow i want to do the following
1. first get all the transaction history of "address"(as you are currently doing @@@alchemy_service.py)
2. then fiter the transaction by the "reference_number": as we are emiting an event the data will be stored in chain logs, so can we just then filter those contract for which one of "sender_reference_number" or "receiver_reference_number" match with the "reference_number"

OR, is there any other way in which we can just get the info through alchemy which only matches the
one of "sender_reference_number" or "receiver_reference_number" with the "reference_number"?

keep in mind that quantity of data can't decrease.which means i need to get all the data field that i am currenlty getting when i am using @@@alchemy_service without any filtering.

3. do the rest(knn,rag) on the filtered transactions.



------

You got it right?
The main difference will be just currently my alchemy service is returning me all the data that belogs to a specefic wallet address, but now i only want those data for which one of "sender_reference_number" or "receiver_reference_number" match with the "reference_number".