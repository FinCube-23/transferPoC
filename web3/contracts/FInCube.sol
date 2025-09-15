// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IFinCubeDAO {
    function checkIsMemberApproved(
        address _member
    ) external view returns (bool);
}

contract FinCube is Initializable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    /// @notice DAO that governs this contract
    address public dao;

    /// @notice The only ERC20 allowed for transfers
    address public approvedERC20;

    /// @notice Used nullifiers to prevent double spending
    mapping(bytes32 => bool) public usedNullifiers;

    event DAOUpdated(address indexed newDAO);
    event ApprovedERC20Updated(address indexed newToken);
    event StablecoinTransfer(
        address indexed from,
        address indexed to,
        uint256 amount,
        string memo,
        bytes32 nullifier
    );

    modifier onlyDAO() {
        require(msg.sender == dao, "Only DAO");
        _;
    }

    /// @notice Initialize the contract with a DAO and an approved ERC20 token
    function initialize(address _dao, address _token) external initializer {
        require(_dao != address(0), "DAO zero");
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        dao = _dao;
        approvedERC20 = _token;
        if (_token != address(0)) emit ApprovedERC20Updated(_token);
        emit DAOUpdated(_dao);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyDAO {}

    /// @notice Update the DAO address (e.g., governance migration)
    /// @dev Must be invoked by the current DAO via a proposal execution
    function setDAO(address newDAO) external onlyDAO {
        require(newDAO != address(0), "DAO zero");
        dao = newDAO;
        emit DAOUpdated(newDAO);
    }

    /// @notice Update the approved ERC20 token address (only via DAO proposal)
    function setApprovedERC20(address newToken) external onlyDAO {
        require(newToken != address(0), "Token zero");
        approvedERC20 = newToken;
        emit ApprovedERC20Updated(newToken);
    }

    /// @notice Transfer stablecoin between DAO members using the approved ERC20
    /// @dev Reentrancy-safe; requires allowance from `from` to this contract.
    /// @dev Both from and to address should be DAO member; Caller must be a member too
    /// @dev Prevents double-spending via nullifier.

    function safeTransfer(
        address from,
        address to,
        uint256 amount,
        string calldata memo,
        bytes32 nullifier
    ) external nonReentrant {
        require(dao != address(0), "DAO not set");
        require(approvedERC20 != address(0), "Token not set");
        require(from != address(0) && to != address(0), "Zero addr");
        require(amount > 0, "Zero amount");
        require(bytes(memo).length > 0, "Empty reference");

        require(
            IFinCubeDAO(dao).checkIsMemberApproved(msg.sender),
            "Caller not member"
        );
        require(
            IFinCubeDAO(dao).checkIsMemberApproved(from),
            "From not member"
        );
        require(IFinCubeDAO(dao).checkIsMemberApproved(to), "To not member");

        require(
            IERC20(approvedERC20).allowance(from, address(this)) >= amount,
            "Insufficient allowance"
        );
        require(
            IERC20(approvedERC20).balanceOf(from) >= amount,
            "Insufficient balance"
        );

        // 🔑 Bind nullifier to the full transfer intent
        bytes32 transferId = keccak256(
            abi.encode(from, to, amount, keccak256(bytes(memo)), nullifier)
        );
        require(!usedNullifiers[transferId], "Nullifier already used");
        usedNullifiers[transferId] = true;

        // Transfer funds
        IERC20(approvedERC20).safeTransferFrom(from, to, amount);

        emit StablecoinTransfer(from, to, amount, memo, nullifier);
    }
}
