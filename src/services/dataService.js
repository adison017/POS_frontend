import apiClient from './apiClient'

const ensureArray = (value) => {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  return []
}

const normalizeRecord = (value) => {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  if (Array.isArray(value?.data)) return value.data[0] ?? null
  return value
}

const withErrorHandling = async (operation, onError) => {
  try {
    return await operation()
  } catch (error) {
    console.error('[dataService]', error)
    return typeof onError === 'function' ? onError(error) : onError
  }
}

const successResult = (data) => ({ data })
const errorResult = (error) => ({ error })

// Menu Categories
export const getMenuCategories = async () =>
  withErrorHandling(
    async () => {
      const { data } = await apiClient.get('/menu-categories')
      return ensureArray(data)
    },
    [],
  )

export const createMenuCategory = async (category) =>
  withErrorHandling(
    async () => {
      const { data } = await apiClient.post('/menu-categories', category)
      return successResult(normalizeRecord(data))
    },
    (error) => errorResult(error.message),
  )

export const updateMenuCategory = async (id, updates) =>
  withErrorHandling(
    async () => {
      const { data } = await apiClient.patch(`/menu-categories/${id}`, updates)
      return successResult(normalizeRecord(data))
    },
    (error) => errorResult(error.message),
  )

// Menu Items
export const getMenuItems = async () =>
  withErrorHandling(
    async () => {
      const { data } = await apiClient.get('/menu-items')
      return ensureArray(data)
    },
    [],
  )

export const createMenuItem = async (item) =>
  withErrorHandling(
    async () => {
      const { data } = await apiClient.post('/menu-items', item)
      return successResult(normalizeRecord(data))
    },
    (error) => errorResult(error.message),
  )

export const updateMenuItem = async (id, updates) =>
  withErrorHandling(
    async () => {
      const { data } = await apiClient.patch(`/menu-items/${id}`, updates)
      return successResult(normalizeRecord(data))
    },
    (error) => errorResult(error.message),
  )

// Orders
export const getOrders = async () =>
  withErrorHandling(
    async () => {
      const { data } = await apiClient.get('/orders')
      return ensureArray(data)
    },
    [],
  )

export const getOrdersPage = async ({ limit = 50, offset = 0, from, to } = {}) =>
  withErrorHandling(
    async () => {
      const { data } = await apiClient.get('/orders', {
        params: { limit, offset, from, to },
      })
      return ensureArray(data)
    },
    [],
  )

export const getLatestOrderNo = async () =>
  withErrorHandling(
    async () => {
      const { data } = await apiClient.get('/orders/latest')
      return data?.latestOrderNo ?? null
    },
    null,
  )

export const createOrder = async (order) =>
  withErrorHandling(
    async () => {
      const { data } = await apiClient.post('/orders', order)
      return successResult(normalizeRecord(data))
    },
    (error) => errorResult(error.message),
  )

export const updateOrder = async (id, updates) =>
  withErrorHandling(
    async () => {
      const { data } = await apiClient.patch(`/orders/${id}`, updates)
      return successResult(normalizeRecord(data))
    },
    (error) => errorResult(error.message),
  )

// Order Items
export const getOrderItems = async (orderId) =>
  withErrorHandling(
    async () => {
      const { data } = await apiClient.get('/order-items', {
        params: { orderId },
      })
      return ensureArray(data)
    },
    [],
  )

export const createOrderItem = async (item) =>
  withErrorHandling(
    async () => {
      const { data } = await apiClient.post('/order-items', item)
      return successResult(normalizeRecord(data))
    },
    (error) => errorResult(error.message),
  )

// Kitchen Tickets
export const getKitchenTickets = async () =>
  withErrorHandling(
    async () => {
      const { data } = await apiClient.get('/kitchen-tickets')
      return ensureArray(data)
    },
    [],
  )

export const createKitchenTicket = async (ticket) =>
  withErrorHandling(
    async () => {
      const { data } = await apiClient.post('/kitchen-tickets', ticket)
      return successResult(normalizeRecord(data))
    },
    (error) => errorResult(error.message),
  )

export const updateKitchenTicket = async (id, updates) =>
  withErrorHandling(
    async () => {
      const { data } = await apiClient.patch(`/kitchen-tickets/${id}`, updates)
      return successResult(normalizeRecord(data))
    },
    (error) => errorResult(error.message),
  )

// Payment Methods
export const getPaymentMethods = async () =>
  withErrorHandling(
    async () => {
      const { data } = await apiClient.get('/payment-methods')
      return ensureArray(data)
    },
    [],
  )

export const createPaymentMethod = async (paymentMethod) =>
  withErrorHandling(
    async () => {
      const { data } = await apiClient.post('/payment-methods', paymentMethod)
      return successResult(normalizeRecord(data))
    },
    (error) => errorResult(error.message),
  )

export const updatePaymentMethod = async (id, updates) =>
  withErrorHandling(
    async () => {
      const { data } = await apiClient.patch(`/payment-methods/${id}`, updates)
      return successResult(normalizeRecord(data))
    },
    (error) => errorResult(error.message),
  )

// Expenses
export const getExpenses = async () =>
  withErrorHandling(
    async () => {
      const { data } = await apiClient.get('/expenses')
      return ensureArray(data)
    },
    [],
  )

export const createExpense = async (expense) =>
  withErrorHandling(
    async () => {
      const { data } = await apiClient.post('/expenses', expense)
      return successResult(normalizeRecord(data))
    },
    (error) => errorResult(error.message),
  )

// Income
export const getIncome = async () =>
  withErrorHandling(
    async () => {
      const { data } = await apiClient.get('/income')
      return ensureArray(data)
    },
    [],
  )

export const createIncome = async (income) =>
  withErrorHandling(
    async () => {
      const { data } = await apiClient.post('/income', income)
      return successResult(normalizeRecord(data))
    },
    (error) => errorResult(error.message),
  )