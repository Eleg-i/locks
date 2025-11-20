# @cailiao/locks —— Web Locks API Wrapper

[简体中文](readme/README-zh-cn.md) | English

## Description

A lightweight wrapper based on the Web Locks API, providing a cleaner interface for managing resource locks with support for shared locks, exclusive locks, timeout control, and more.

## Getting Started

Install the package

```bash
npm i @cailiao/locks
```

#### Import

```javascript
import Locks from '@cailiao/locks'
```

## API Documentation

### Locks.request()

Request a lock, returns a Promise that resolves with the lock object which can be used to release the lock.

#### Parameters

- `name`: `string` type, optional, lock name, defaults to a randomly generated UUID.
- `opt`: `Object` type, optional, lock options.
  - `mode`: `string` type, optional, lock mode, default `exclusive`, possible values are `shared` or `exclusive`.
    - `exclusive`: Exclusive lock, only one can hold the lock at a time.
    - `shared`: Shared lock, multiple can hold the lock simultaneously.
  - `ifAvailable`: `boolean` type, optional, whether to allow acquiring the lock.
  - `steal`: `boolean` type, optional, whether to allow stealing the lock.
  - `signal`: `AbortSignal` type, optional, unlock signal.
  - `timeout`: `number` type, optional, timeout in milliseconds, default 10000 ms.
- `callback`: `Function` type, optional, callback function that receives the lock object as a parameter.

#### Return Value

`Promise<Lock | null>`, Promise that returns the lock object.

#### Examples

Basic usage (using try-finally pattern):

```javascript
let lock = null
try {
  // Request lock
  lock = await Locks.request('persistState')
  
  // Perform operations that need synchronization
  await setData()
} finally {
  // Ensure lock is released
  if (lock) Locks.release(lock)
}
```

Using callback function:

```javascript
await Locks.request('persistState', {}, async (lock) => {
  // Auto holds lock in the callback
  await setData()
  // Lock is automatically released after callback ends
})
```

Setting timeout:

```javascript
try {
  const lock = await Locks.request('criticalSection', { timeout: 5000 })
  // Perform operations
  Locks.release(lock)
} catch (error) {
  if (error.name === 'TimeoutError') {
    console.error('Lock acquisition timed out')
  }
}
```

Using shared lock:

```javascript
// Use shared lock for read-only operations
const lock = await Locks.request('readData', { mode: 'shared' })
try {
  await readData()
} finally {
  Locks.release(lock)
}
```

### Locks.release()

Release the lock.

#### Parameters

- `lock`: `Lock` type, required, the lock object to release.

#### Example

```javascript
const lock = await Locks.request('resource')
try {
  // Use the resource
} finally {
  Locks.release(lock)
}
```

### Locks.query()

Query if the lock is released, returns a Promise that resolves when the lock is released, used in scenarios where you only need to wait for the lock to be released without needing to acquire it.

#### Parameters

- `name`: `string` type, required, the name of the lock to query.

#### Return Value

`Promise<void>`

#### Example

```javascript
// Wait for other processes to release the lock
await Locks.query('criticalResource')
console.log('Lock has been released, can proceed with operations')
```

### Locks.find()

Query if the lock exists (is occupied), returns true if it exists, false otherwise.

#### Parameters

- `name`: `string` type, required, the name of the lock to query.

#### Return Value

`Promise<boolean>`, whether the lock exists.

#### Example

```javascript
const isLocked = await Locks.find('myResource')
if (isLocked) {
  console.log('Resource is locked')
} else {
  console.log('Resource is available')
}
```

### Locks.list()

Query all lock statuses.

#### Return Value

`Promise<{held?: LockInfo[], pending?: LockInfo[]}>`, containing information about all held and pending locks.

#### Example

```javascript
const allLocks = await Locks.list()
console.log('Held locks:', allLocks.held)
console.log('Pending locks:', allLocks.pending)
```

### Locks.status()

Query the detailed status of a specified lock.

#### Parameters

- `name`: `string | Lock` type, required, the name of the lock or lock object to query.

#### Return Value

`Promise<LockInfo & {held: boolean, pending: boolean} | undefined>`, detailed status information of the lock.

#### Example

Query using lock name:

```javascript
const status = await Locks.status('myLock')
if (status) {
  console.log('Lock status:', status)
  console.log('Is held:', status.held)
  console.log('Is in waiting queue:', status.pending)
  console.log('Lock mode:', status.mode)
}
```

Query using lock object:

```javascript
const lock = await Locks.request('myLock')
const status = await Locks.status(lock)
console.log('Lock status:', status)
Locks.release(lock)
```

## Advanced Usage

### Handling Lock Timeouts

```javascript
try {
  const lock = await Locks.request('resource', { timeout: 3000 })
  try {
    // Perform operations
  } finally {
    Locks.release(lock)
  }
} catch (error) {
  if (error.name === 'TimeoutError') {
    console.error('Failed to acquire lock, please try again later')
    // Can implement retry logic
  }
}
```

### Concurrency Control Example

```javascript
// Multiple async operations need to access the same resource synchronously
async function updateSharedResource() {
  let lock = null
  try {
    lock = await Locks.request('sharedResource')
    // Read current value
    const currentValue = await fetchData()
    // Update value
    const newValue = currentValue + 1
    // Save updated value
    await saveData(newValue)
    return newValue
  } finally {
    if (lock) Locks.release(lock)
  }
}

// Concurrent calls but will be executed serially
Promise.all([
  updateSharedResource(),
  updateSharedResource(),
  updateSharedResource()
])
```

### Using AbortSignal to Cancel Lock Requests

```javascript
const controller = new AbortController()

// Cancel lock request after 5 seconds
setTimeout(() => controller.abort(), 5000)

try {
  const lock = await Locks.request('resource', { signal: controller.signal })
  // Use the lock
  Locks.release(lock)
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Lock request has been canceled')
  }
}
```

## Notes

1. Always ensure to release the lock in a finally block to prevent deadlocks.
2. Web Locks API may not be available in some environments, feature detection is recommended before use.
3. Set a reasonable timeout for long-running operations.
4. Shared locks are suitable for read-only operations, exclusive locks are suitable for read-write operations.

## Support

Like this project? Please give it a star to show your support! ⭐

Your star helps the project gain more attention and encourages further development.
