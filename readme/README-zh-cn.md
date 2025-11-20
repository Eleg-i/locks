# @cailiao/locks —— Web Locks API 封装

简体中文 | [English](../README.md)

## 描述

基于 Web Locks API 的轻量级封装，提供更简洁的接口来管理资源锁，支持共享锁、排他锁、超时控制等功能。

## 开始使用

安装依赖包

```bash
npm i @cailiao/locks
```

#### 导入

```javascript
import Locks from '@cailiao/locks'
```

## API 文档

### Locks.request()

申请锁，返回一个 Promise，resolve 时返回锁对象，此锁对象可以用来解锁。

#### 参数

- `name`：`string` 类型，可选，锁名称，默认为随机生成的 UUID。
- `opt`：`Object` 类型，可选，锁选项。
  - `mode`：`string` 类型，可选，锁模式，默认 `exclusive`，可选值为 `shared` 或 `exclusive`。
    - `exclusive`：排他锁，同一时间只有一个持有锁。
    - `shared`：共享锁，多个可以同时持有锁。
  - `ifAvailable`：`boolean` 类型，可选，是否允许获取锁。
  - `steal`：`boolean` 类型，可选，是否允许抢占锁。
  - `signal`：`AbortSignal` 类型，可选，解锁信号。
  - `timeout`：`number` 类型，可选，超时时间，默认 10000 毫秒。
- `callback`：`Function` 类型，可选，回调函数，接收锁对象作为参数。

#### 返回值

`Promise<Lock | null>`，返回锁对象的 Promise。

#### 示例

基本用法（使用 try-finally 模式）：

```javascript
let lock = null
try {
  // 申请锁
  lock = await Locks.request('persistState')
  
  // 执行需要同步的操作
  await setData()
} finally {
  // 确保释放锁
  if (lock) Locks.release(lock)
}
```

使用回调函数：

```javascript
await Locks.request('persistState', {}, async (lock) => {
  // 在回调中自动持有锁
  await setData()
  // 回调结束后自动释放锁
})
```

设置超时时间：

```javascript
try {
  const lock = await Locks.request('criticalSection', { timeout: 5000 })
  // 执行操作
  Locks.release(lock)
} catch (error) {
  if (error.name === 'TimeoutError') {
    console.error('获取锁超时')
  }
}
```

使用共享锁：

```javascript
// 只读操作使用共享锁
const lock = await Locks.request('readData', { mode: 'shared' })
try {
  await readData()
} finally {
  Locks.release(lock)
}
```

### Locks.release()

释放锁。

#### 参数

- `lock`：`Lock` 类型，必需，要释放的锁对象。

#### 示例

```javascript
const lock = await Locks.request('resource')
try {
  // 使用资源
} finally {
  Locks.release(lock)
}
```

### Locks.query()

查询锁是否释放，返回一个 Promise，在锁释放时 resolve，用在仅等待锁释放，但不需要加锁的场景。

#### 参数

- `name`：`string` 类型，必需，要查询的锁名称。

#### 返回值

`Promise<void>`

#### 示例

```javascript
// 等待其他进程释放锁
await Locks.query('criticalResource')
console.log('锁已释放，可以继续操作')
```

### Locks.find()

查询锁是否存在（被占用），存在则返回 true，否则返回 false。

#### 参数

- `name`：`string` 类型，必需，要查询的锁名称。

#### 返回值

`Promise<boolean>`，锁是否存在。

#### 示例

```javascript
const isLocked = await Locks.find('myResource')
if (isLocked) {
  console.log('资源已被锁定')
} else {
  console.log('资源可用')
}
```

### Locks.list()

查询所有锁状态。

#### 返回值

`Promise<{held?: LockInfo[], pending?: LockInfo[]}>`，包含所有已持有和待处理的锁信息。

#### 示例

```javascript
const allLocks = await Locks.list()
console.log('已持有锁:', allLocks.held)
console.log('待处理锁:', allLocks.pending)
```

### Locks.status()

查询指定锁的详细状态。

#### 参数

- `name`：`string | Lock` 类型，必需，要查询的锁名称或锁对象。

#### 返回值

`Promise<LockInfo & {held: boolean, pending: boolean} | undefined>`，锁的详细状态信息。

#### 示例

使用锁名称查询：

```javascript
const status = await Locks.status('myLock')
if (status) {
  console.log('锁状态:', status)
  console.log('是否被持有:', status.held)
  console.log('是否在等待队列:', status.pending)
  console.log('锁模式:', status.mode)
}
```

使用锁对象查询：

```javascript
const lock = await Locks.request('myLock')
const status = await Locks.status(lock)
console.log('锁状态:', status)
Locks.release(lock)
```

## 高级用法

### 处理锁超时

```javascript
try {
  const lock = await Locks.request('resource', { timeout: 3000 })
  try {
    // 执行操作
  } finally {
    Locks.release(lock)
  }
} catch (error) {
  if (error.name === 'TimeoutError') {
    console.error('无法获取锁，请稍后再试')
    // 可以实现重试逻辑
  }
}
```

### 并发控制示例

```javascript
// 多个异步操作需要同步访问同一个资源
async function updateSharedResource() {
  let lock = null
  try {
    lock = await Locks.request('sharedResource')
    // 读取当前值
    const currentValue = await fetchData()
    // 更新值
    const newValue = currentValue + 1
    // 保存更新后的值
    await saveData(newValue)
    return newValue
  } finally {
    if (lock) Locks.release(lock)
  }
}

// 并发调用但会被串行执行
Promise.all([
  updateSharedResource(),
  updateSharedResource(),
  updateSharedResource()
])
```

### 使用 AbortSignal 取消锁请求

```javascript
const controller = new AbortController()

// 5秒后取消锁请求
setTimeout(() => controller.abort(), 5000)

try {
  const lock = await Locks.request('resource', { signal: controller.signal })
  // 使用锁
  Locks.release(lock)
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('锁请求已取消')
  }
}
```

## 注意事项

1. 确保始终在 finally 块中释放锁，以防止死锁。
2. Web Locks API 在某些环境中可能不可用，建议在使用前进行特性检测。
3. 对于长时间运行的操作，应设置合理的超时时间。
4. 共享锁适用于只读操作，排他锁适用于读写操作。

## 支持

喜欢这个项目吗？请给它一个 star 以示支持！⭐

您的 star 有助于项目获得更多关注，并鼓励进一步的开发。
