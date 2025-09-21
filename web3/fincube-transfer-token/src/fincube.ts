import {
  Upgraded as UpgradedEvent,
  StablecoinTransfer as StablecoinTransferEvent
} from "../generated/Fincube/Fincube"

import { Bytes, BigInt } from "@graphprotocol/graph-ts"

import {
  Upgraded,
  StablecoinTransfer
} from "../generated/schema"

export function handleUpgraded(event: UpgradedEvent): void {
  let entity = new Upgraded(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.implementation = event.params.implementation
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  
  entity.save()
}

export function handleStablecoinTransfer(event: StablecoinTransferEvent): void {
  // The ID must be a string
  let entity = new StablecoinTransfer(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  )

  entity.from = event.params.from
  entity.to = event.params.to
  entity.amount = event.params.amount
  entity.memo = event.params.memo
  entity.memoHash = event.params.memoHash.toHexString()
  entity.nullifier = event.params.nullifier
  entity.blockNumber = event.block.number
  entity.timestamp = event.block.timestamp
  entity.txHash = event.transaction.hash

  entity.save()
}
