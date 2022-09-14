import {Contract} from '../Contract';
import {Callable, Sendable} from '../Invokation';
import {encodedNumber} from '../Encoding';

interface PriceOracleMethods {
  assetPrices(asset: string): Callable<number>
  setUnderlyingPrice(cToken: string, amount: encodedNumber): Sendable<number>
  setDirectPrice(address: string, amount: encodedNumber): Sendable<number>

  // Nectar Price Oracle
  getPrice(asset: string): Callable<number>
  readers(asset: string): Callable<string>
  anchorAdmin(): Callable<string>
  pendingNectarAdmin(): Callable<string>
  poster(): Callable<string>
  maxSwing(): Callable<number>
  anchors(asset: string): Callable<{0: number, 1: number}>
  pendingNectars(asset: string): Callable<number>
  _setPendingNectar(asset: string, price: encodedNumber): Sendable<number>
  _setPaused(paused: boolean): Sendable<number>
  _setPendingNectarAdmin(string): Sendable<number>
  _acceptNectarAdmin(): Sendable<number>
  setPrice(asset: string, price: encodedNumber): Sendable<number>
  setPrices(assets: string[], prices: encodedNumber[]): Sendable<number>
}

export interface PriceOracle extends Contract {
  methods: PriceOracleMethods
  name: string
}
