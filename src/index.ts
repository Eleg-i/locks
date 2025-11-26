/**
 * 锁
 */
export default class Locks {
  static #manager = navigator.locks

  static #lockMap = new WeakMap<Lock,() => unknown>()

  /**
   * 申请锁，返回一个Promise，resolve 时返回锁对象，此锁对象可以用来解锁
   * @param name            锁名称
   * @param opt             锁选项
   * @param opt.mode        锁模式，默认 exclusive，可选值为 shared 或 exclusive，shared 表示共享锁，exclusive 表示排他锁
   * @param opt.ifAvailable 是否允许获取锁
   * @param opt.steal       是否允许抢占锁
   * @param opt.signal      解锁信号
   * @param opt.timeout     超时时间
   * @param callback        回调函数
   */
  static async request(
    name: string = crypto.randomUUID(),
    opt: {
      mode?: 'shared' | 'exclusive'
      ifAvailable?: boolean
      steal?: boolean
      signal?: AbortSignal
      timeout?: number
    } = { timeout: 1e4 },
    callback?: <T = unknown>(lock?: Lock | null) => T | void
  ) {
    let signal: AbortSignal | undefined = opt.signal!
    const {
      promise: waitLock,
      resolve: getLock,
      reject: rejectorLock
    } = Promise.withResolvers<Lock | null>()
    const { timeout = 1e4, steal } = opt
    const timeoutSignal = timeout && !steal ? AbortSignal.timeout(timeout) : void 0

    if (signal) {
      const innerSigbalCtrl = new AbortController()

      signal.addEventListener('abort', () => {
        innerSigbalCtrl.abort()
      })

      timeoutSignal?.addEventListener('abort', reson => {
        innerSigbalCtrl.abort(reson)
      })

      signal = innerSigbalCtrl.signal
    } else signal = timeoutSignal

    this.#manager
      .request(name, { ...opt, signal }, async lock => {
        getLock(lock)

        if (callback) return await callback(lock)

        const { promise: waitDone, resolve: done } = Promise.withResolvers<void>()

        if (lock) this.#lockMap.set(lock, done)
        await waitDone
      })
      .catch((err: any) => {
        if (err.name === 'TimeoutError') console.warn(`lock ${name} timeout`)
        rejectorLock(err)
      })

    return waitLock
  }

  /**
   * 释放锁
   * @param lock 要释放的锁
   */
  static release(lock: Lock) {
    this.#lockMap.get(lock)?.()
  }

  /**
   * 查询锁是否释放，返回一个 Promise，在锁释放时 resolve，用在仅等待锁释放，但不需要加锁的场景
   * @param name 要查询的锁名称
   */
  static query(name: string) {
    return this.#manager.request(name, {}, () => {})
  }

  /**
   * 查询锁是否存在（被占用），存在则返回 true，否则返回 false
   * @param name 要查询的锁名称
   */
  static async find(name: string) {
    const { held, pending } = await this.#manager.query()

    return held?.some(lock => lock.name === name) || pending?.some(lock => lock.name === name)
  }

  /**
   * 查询所有锁状态
   */
  static list() {
    return this.#manager.query()
  }

  /**
   * 查询所有锁状态
   * @param name 要查询的锁名称 | 对象
   */
  static async status(name: string | Lock) {
    let queryRes: LockInfo & {
      pending: boolean
      held: boolean
    }
    const innerName = typeof name === 'string' ? name : name?.name
    const all = await this.#manager.query()

    if (innerName) {
      let heldLock: LockInfo | undefined, pendingLock: LockInfo | undefined
      const { held, pending } = all

      if (held) for (const lock of held) if (lock.name === innerName) heldLock = lock

      if (pending) for (const lock of pending) if (lock.name === innerName) pendingLock = lock

      if (!(heldLock || pendingLock)) return

      queryRes = {
        held: Boolean(heldLock),
        pending: Boolean(pendingLock),
        ...heldLock ?? pendingLock
      }
    }

    return queryRes!
  }
}
