# FinCube + FinCubeDAO

A minimal on-chain governance + stablecoin transfer system composed of two upgradeable contracts:

- **FinCubeDAO** — FinCubeDAO that manages members and executes proposals.
- **FinCube** — a UUPS‑upgradeable stablecoin transfer contract governed by the DAO.

This README explains how they fit together, how to deploy via proxy, how to run a token‑update proposal, and how to use the member‑gated `safeTransfer`.

---

## Table of contents
- [FinCube + FinCubeDAO](#fincube--fincubedao)
  - [Table of contents](#table-of-contents)
  - [Architecture](#architecture)
  - [Contracts overview](#contracts-overview)
    - [FinCubeDAO](#fincubedao)
    - [FinCube](#fincube)
  - [Deploying (UUPS proxies)](#deploying-uups-proxies)
    - [Remix + ERC1967Proxy](#remix--erc1967proxy)
  - [Governance parameters](#governance-parameters)
  - [Proposals](#proposals)
    - [Propose: update the approved ERC‑20 on FinCube](#propose-update-the-approved-erc20-on-fincube)
    - [Voting and execution](#voting-and-execution)
  - [Using `safeTransfer`](#using-safetransfer)
  - [Events](#events)
  - [Security notes / gotchas](#security-notes--gotchas)
  - [License](#license)

---

## Architecture

```
EOA(s) ── propose/vote ──▶ FinCubeDAO (UUPS proxy)
                           │
                           │  execute (when passed)
                           ▼
                      FinCube (UUPS proxy)
                           │
     only DAO can set       │        member‑gated transfers
     approved ERC‑20 ◀──────┘        (ERC‑20 safeTransferFrom)
```

- **FinCubeDAO** owns the governance process. Members propose actions, policy and vote on it.
- When a proposal passes and the voting window ends, **FinCubeDAO** executes the encoded call against **FinCube** (e.g., calling `setApprovedERC20(address)`), which succeeds because FinCube restricts these functions with `onlyDAO`.
- **FinCube** provides `safeTransfer(from, to, amount, memo)` that:
  - checks the caller, `from`, and `to` are **approved DAO members**;
  - requires allowance and balance on the approved ERC‑20;
  - performs `safeTransferFrom` and emits an event with a **non‑empty memo**.

---

## Contracts overview

### FinCubeDAO

Key features:
- **Upgradeable** via UUPS (`UUPSUpgradeable`, `OwnableUpgradeable`, `ReentrancyGuardUpgradeable`).
- **Members**: `registerMember`, on execution of a `NewMemberProposal` the DAO approves members.
- **Governance parameters**: `setVotingDelay(seconds)`, `setVotingPeriod(seconds)`.
- **Proposals**:
  - `newMemberApprovalProposal(address, description)`
  - `propose(address[] targets, uint256[] values, bytes[] calldatas, string description)`
- **Voting**: `castVote(proposalId, support)` with a simple majority threshold `ceil(memberCount/2)`.
- **Execution**: `executeProposal(proposalId)` after `voteEnd` (stored in `voteDuration`) and with sufficient `yesvotes`.
- **Utility**: `checkIsMemberApproved(address) → bool` (used by FinCube for membership checks).

> **Note on encoding addresses for member proposals**: the DAO uses `toBytes(address)` when creating a `NewMemberProposal`. Keep using that helper when building the calldata for membership approvals.

### FinCube

Key features:
- **Upgradeable** (UUPS) with upgrades authorized **only by the DAO** via `_authorizeUpgrade`.
- **Governed fields** (DAO‑only):
  - `setDAO(address newDAO)`
  - `setApprovedERC20(address newToken)`
- **Member‑gated transfer**:
  - `safeTransfer(address from, address to, uint256 amount, string memo)` requires:
    - DAO is set; approved ERC‑20 is set
    - `msg.sender`, `from`, and `to` are approved members per DAO
    - non‑zero `amount` and **non‑empty `memo`**
    - `allowance(from, FinCube) ≥ amount` and `balanceOf(from) ≥ amount`
  - emits `StablecoinTransfer(from, to, amount, memo)` 
  - memo follow ISO:20022 Standard

---

## Deploying (UUPS proxies)

You **must** use proxy deployment for upgradeable contracts. Do **not** call `initialize` on implementation contracts.

### Remix + ERC1967Proxy

1. **Deploy FinCubeDAO (implementation)** — do nothing else with it.
2. **Encode init data** for DAO:
   - function: `initialize(string _daoURI, string _ownerURI)`
   - use Remix’s ABI encoder or `web3.eth.abi.encodeFunctionCall`.
3. **Deploy ERC1967Proxy** with:
   - `_logic` = DAO implementation
   - `_data`  = encoded init data
   - resulting address is **DAO proxy**
4. **Deploy FinCube (implementation)** — do nothing else with it.
5. **Encode init data** for FinCube:
   - function: `initialize(address _dao, address _token)`
   - `_dao` = **DAO proxy** address, `_token` = initial ERC‑20 (or `0x0`)
6. **Deploy ERC1967Proxy** for FinCube with its init data — resulting address is **FinCube proxy**.



## Governance parameters

Before proposing/voting, set timing:

```solidity
DAO.setVotingDelay(0);           // for quick testing
DAO.setVotingPeriod(120);        // e.g., 2 minutes
```

Voting is allowed when `now > voteStart && now < voteEnd`, execution requires `now ≥ voteEnd` and majority `yesvotes ≥ proposalThreshold()`.

---

## Proposals

### Propose: update the approved ERC‑20 on FinCube

- **Target**: FinCube **proxy** address
- **Value**: `0`
- **Calldata**: encoded `setApprovedERC20(address)`

**Remix inputs (strict JSON):**
```json
{
  "targets": ["0xFinCubeProxy..."],
  "values": [0],
  "calldatas": ["0x314b6256…"],
  "description": "Update approved ERC20"
}
```

**Solidity encoding:**
```solidity
bytes memory data = abi.encodeWithSignature(
    "setApprovedERC20(address)",
    0xYourNewToken...
);
```

**Safer (0.8.12+):**
```solidity
bytes memory data = abi.encodeWithSelector(FinCube.setApprovedERC20.selector, 0xYourNewToken...);
// or: abi.encodeCall(FinCube.setApprovedERC20, (0xYourNewToken...));
```

**ethers v6:**
```js
const iface = new ethers.Interface([
  "function setApprovedERC20(address newToken)"
]);
const calldata = iface.encodeFunctionData("setApprovedERC20", [newToken]);
```

> Ensure you pass `calldatas` as an **array of quoted hex strings** in Remix.

### Voting and execution
1. **Propose** as a member.
2. **Vote** during the window (`now > start && now < end`).
3. After `voteEnd`, call **`executeProposal(proposalId)`**. The DAO will:
   - for `GeneralProposal`: `Address.functionCall(target, data)`
   - for `NewMemberProposal`: call `approveMember(...)` internally

---

## Using `safeTransfer`

1. Ensure **FinCube.approvedERC20** is set (initially in `initialize` or via a DAO proposal).
2. The **`from`** account must approve the FinCube proxy on the ERC‑20:
   - `approve(FinCubeProxy, amount)`
3. Call `safeTransfer(from, to, amount, memo)` with **Value = 0**. Requirements:
   - `msg.sender` is an approved member
   - `from` and `to` are approved members
   - `memo` is in JSON format following ISO:20022 standard. It will be used for on-ramping and off-ramping.
   - `allowance(from, FinCube) ≥ amount` and `balanceOf(from) ≥ amount`

**Common reverts & causes**
- `Caller/From/To not member` — register + approve in DAO first.
- `Insufficient allowance` — run `approve` from the **from** account.
- `Insufficient balance` — top up the **from** account.
- `Only DAO` — attempting to call DAO‑only functions (`setApprovedERC20`, `setDAO`).
- `DAO not set` / `Token not set` — check `initialize` input and/or proposals.

---

## Events

**FinCubeDAO**
- `MemberRegistered(address newMember, string memberURI)`
- `MemberApproved(address member)`
- `ProposalAdded(ProposalType, uint256 proposalId, bytes data)`
- `ProposalCreated(...)`
- `VoteCast(address voter, uint256 proposalId, uint8 support, uint256 weight, string reason)`
- `ProposalExecuted(uint256 proposalId)`
- `ProposalCanceled(uint256 proposalId)`

**FinCube**
- `DAOUpdated(address newDAO)`
- `ApprovedERC20Updated(address newToken)`
- `StablecoinTransfer(address from, address to, uint256 amount, string memo)`



---


## Security notes / gotchas

- **Execution timing**: execution requires `now ≥ voteEnd`. Voting requires `now > voteStart && now < voteEnd`.
- **Threshold stability**: current threshold is computed as `(memberCount + 1) / 2` at execution time. If membership changes between voting and execution, results may differ from expectations. Consider snapshotting if this matters for your use case.
- **`bytesToAddress` usage**: use the provided `toBytes(address)` helper when creating `NewMemberProposal` data to avoid encoding mismatches.
- **Reentrancy**: token transfers use `SafeERC20` and `nonReentrant` guards.
- **Proxies**: Never call state‑changing functions on implementation contracts; storage lives in the proxies.

---

## License

MIT