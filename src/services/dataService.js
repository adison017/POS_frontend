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

// Add function to fetch all menu categories (including inactive ones) for admin management
export const getAllMenuCategories = async () =>
  withErrorHandling(
    async () => {
      const { data } = await apiClient.get('/menu-categories?showAll=true')
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

// Add delete menu category function
export const deleteMenuCategory = async (id) =>
  withErrorHandling(
    async () => {
      const { data } = await apiClient.delete(`/menu-categories/${id}`)
      return successResult(data)
    },
    (error) => errorResult(error.message),
  )

// Menu Items
export const getMenuItems = async () =>
  withErrorHandling(
    async () => {
      console.log('[dataService] Fetching menu items')
      const { data } = await apiClient.get('/menu-items')
      console.log('[dataService] Menu items fetched:', data)
      return ensureArray(data)
    },
    [],
  )

// Add function to fetch all menu items (including inactive ones) for admin management
export const getAllMenuItems = async () =>
  withErrorHandling(
    async () => {
      console.log('[dataService] Fetching all menu items')
      const { data } = await apiClient.get('/menu-items?showAll=true')
      console.log('[dataService] All menu items fetched:', data)
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

// Add delete menu item function
export const deleteMenuItem = async (id) =>
  withErrorHandling(
    async () => {
      const { data } = await apiClient.delete(`/menu-items/${id}`)
      return successResult(data)
    },
    (error) => errorResult(error.message),
  )

// Orders
export const getOrders = async () =>
  withErrorHandling(
    async () => {
      // Limit to 50 most recent orders by default to improve performance
      console.log('[dataService] Fetching orders (default limit)')
      const { data } = await apiClient.get('/orders', {
        params: { limit: 50, offset: 0 }
      })
      console.log('[dataService] Orders fetched:', data)
      return ensureArray(data)
    },
    [],
  )

export const getOrdersPage = async ({ limit = 20, offset = 0, from, to } = {}) =>
  withErrorHandling(
    async () => {
      const params = { limit, offset }
      if (from) params.from = from
      if (to) params.to = to
      
      console.log('[dataService] Fetching orders page:', { params })
      const { data } = await apiClient.get('/orders', { params })
      console.log('[dataService] Orders page fetched:', data)
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
      if (!orderId) return []
      console.log('[dataService] Fetching order items for order:', orderId)
      const { data } = await apiClient.get('/order-items', {
        params: { orderId },
      })
      console.log('[dataService] Order items fetched:', data)
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
export const getKitchenTickets = async (limit = 100) =>
  withErrorHandling(
    async () => {
      // Limit to specified number of most recent tickets by default to improve performance
      console.log('[dataService] Fetching kitchen tickets')
      const { data } = await apiClient.get('/kitchen-tickets', {
        params: { limit }
      })
      console.log('[dataService] Kitchen tickets fetched:', data)
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
      console.log('[dataService] Fetching payment methods')
      const { data } = await apiClient.get('/payment-methods')
      console.log('[dataService] Payment methods fetched:', data)
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
export const getExpenses = async (limit = 100) =>
  withErrorHandling(
    async () => {
      // Limit to specified number of most recent expenses by default to improve performance
      console.log('[dataService] Fetching expenses')
      const { data } = await apiClient.get('/expenses', {
        params: { limit }
      })
      console.log('[dataService] Expenses fetched:', data)
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
export const getIncome = async (limit = 100) =>
  withErrorHandling(
    async () => {
      // Limit to specified number of most recent income records by default to improve performance
      console.log('[dataService] Fetching income')
      const { data } = await apiClient.get('/income', {
        params: { limit }
      })
      console.log('[dataService] Income fetched:', data)
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