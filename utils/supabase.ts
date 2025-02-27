import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys for different data types
const STORAGE_KEYS = {
  USERS: '@expense_tracker_users',
  CURRENT_USER: '@expense_tracker_current_user',
  EXPENSES: '@expense_tracker_expenses',
  CATEGORIES: '@expense_tracker_categories',
  QUICK_EXPENSES: '@expense_tracker_quick_expenses'
};

// In-memory data store
let dataStore = {
  users: [],
  expenses: [],
  categories: [],
  quickExpenses: [],
  currentUser: null
};

// Load all data from AsyncStorage
const loadDataFromStorage = async () => {
  try {
    // Load each data type
    const usersData = await AsyncStorage.getItem(STORAGE_KEYS.USERS);
    const currentUserData = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    const expensesData = await AsyncStorage.getItem(STORAGE_KEYS.EXPENSES);
    const categoriesData = await AsyncStorage.getItem(STORAGE_KEYS.CATEGORIES);
    const quickExpensesData = await AsyncStorage.getItem(STORAGE_KEYS.QUICK_EXPENSES);

    // Parse and store in memory
    if (usersData) dataStore.users = JSON.parse(usersData);
    if (currentUserData) dataStore.currentUser = JSON.parse(currentUserData);
    if (expensesData) dataStore.expenses = JSON.parse(expensesData);
    if (categoriesData) dataStore.categories = JSON.parse(categoriesData);
    if (quickExpensesData) dataStore.quickExpenses = JSON.parse(quickExpensesData);

    console.log('Data loaded successfully from AsyncStorage');
  } catch (error) {
    console.error('Error loading data from AsyncStorage:', error);
  }
};

// Initialize data on module load
loadDataFromStorage();

// Save specific data type to AsyncStorage
const saveToStorage = async (key, data) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving ${key} to AsyncStorage:`, error);
    throw error; // Re-throw to handle in calling function
  }
};

// Create default categories and quick expenses for new user
const createDefaultDataForUser = (userId) => {
  // Define default categories
  const defaultCategories = [
    { id: `cat-${Date.now()}-1`, user_id: userId, name: 'Meals', icon: 'food', color: '#FF7043' },
    { id: `cat-${Date.now()}-2`, user_id: userId, name: 'Coffee', icon: 'coffee', color: '#795548' },
    { id: `cat-${Date.now()}-3`, user_id: userId, name: 'Transport', icon: 'bus', color: '#42A5F5' },
    { id: `cat-${Date.now()}-4`, user_id: userId, name: 'Groceries', icon: 'cart', color: '#66BB6A' },
    { id: `cat-${Date.now()}-5`, user_id: userId, name: 'Utilities', icon: 'lightbulb', color: '#FFC107' },
    { id: `cat-${Date.now()}-6`, user_id: userId, name: 'Entertainment', icon: 'movie', color: '#AB47BC' }
  ];
  
  // Create default quick expenses
  const defaultQuickExpenses = [
    { 
      id: `qe-${Date.now()}-1`, 
      user_id: userId, 
      name: 'Coffee', 
      amount: 5, 
      category: defaultCategories[1].id 
    },
    { 
      id: `qe-${Date.now()}-2`, 
      user_id: userId, 
      name: 'Lunch', 
      amount: 15, 
      category: defaultCategories[0].id 
    }
  ];
  
  // Add to dataStore
  dataStore.categories = [...dataStore.categories, ...defaultCategories];
  dataStore.quickExpenses = [...dataStore.quickExpenses, ...defaultQuickExpenses];
  
  // Save to AsyncStorage
  saveToStorage(STORAGE_KEYS.CATEGORIES, dataStore.categories);
  saveToStorage(STORAGE_KEYS.QUICK_EXPENSES, dataStore.quickExpenses);
  
  return { categories: defaultCategories, quickExpenses: defaultQuickExpenses };
};

// Supabase-like client implementation
export const supabase = {
  auth: {
    // Sign up with email and password
    signUp: async ({ email, password, options }) => {
      try {
        console.log(`Attempting to sign up user with email: ${email}`);
        
        // Check if email already exists
        const userExists = dataStore.users.some(user => user.email === email);
        if (userExists) {
          console.log('User already exists with this email');
          return { error: { message: 'User with this email already exists' } };
        }
        
        // Create new user
        const newUser = {
          id: `user-${Date.now()}`, // Unique ID using timestamp
          email,
          password, // In a real app, this would be hashed
          full_name: options?.data?.full_name || '',
          created_at: new Date().toISOString()
        };
        
        // Add to users list
        dataStore.users = [...dataStore.users, newUser];
        
        // Set as current user (logged in)
        const sessionUser = { ...newUser };
        delete sessionUser.password; // Don't store password in session
        dataStore.currentUser = { user: sessionUser };
        
        // Create default data
        createDefaultDataForUser(newUser.id);
        
        // Save all updated data
        await saveToStorage(STORAGE_KEYS.USERS, dataStore.users);
        await saveToStorage(STORAGE_KEYS.CURRENT_USER, dataStore.currentUser);
        
        console.log(`User created successfully: ${newUser.id}`);
        
        return { 
          data: { 
            user: sessionUser,
            session: { user: sessionUser }
          },
          error: null
        };
      } catch (error) {
        console.error('Error in signUp:', error);
        return { 
          data: null,
          error: { message: 'Failed to create account. Please try again.' } 
        };
      }
    },
    
    // Sign in with email and password
    signInWithPassword: async ({ email, password }) => {
      try {
        console.log(`Attempting to log in with email: ${email}`);
        
        // Find matching user
        const user = dataStore.users.find(u => 
          u.email === email && u.password === password
        );
        
        // Handle invalid credentials
        if (!user) {
          console.log('Invalid login credentials');
          return { 
            data: null,
            error: { message: 'Invalid email or password' } 
          };
        }
        
        // Create session user (without password)
        const sessionUser = { ...user };
        delete sessionUser.password;
        
        // Set as current user
        dataStore.currentUser = { user: sessionUser };
        
        // Save current user to storage
        await saveToStorage(STORAGE_KEYS.CURRENT_USER, dataStore.currentUser);
        
        console.log(`User logged in successfully: ${user.id}`);
        
        return { 
          data: { 
            user: sessionUser,
            session: { user: sessionUser }
          },
          error: null
        };
      } catch (error) {
        console.error('Error in signInWithPassword:', error);
        return { 
          data: null,
          error: { message: 'Failed to log in. Please try again.' } 
        };
      }
    },
    
    // Sign out
    signOut: async () => {
      try {
        console.log('Signing out user');
        
        // Clear current user
        dataStore.currentUser = null;
        
        // Remove from storage
        await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        
        console.log('User signed out successfully');
        
        return { error: null };
      } catch (error) {
        console.error('Error in signOut:', error);
        return { error: { message: 'Failed to sign out' } };
      }
    },
    
    // Get current session
    getSession: async () => {
      try {
        // Return current user session
        console.log('Getting current session:', dataStore.currentUser ? 'User is logged in' : 'No active session');
        return { 
          data: { session: dataStore.currentUser },
          error: null 
        };
      } catch (error) {
        console.error('Error in getSession:', error);
        return { 
          data: { session: null },
          error: { message: 'Failed to get session' } 
        };
      }
    },
    
    // Update user data
    updateUser: async ({ data }) => {
      try {
        if (!dataStore.currentUser) {
          return { error: { message: 'No active session' } };
        }
        
        const userId = dataStore.currentUser.user.id;
        const userIndex = dataStore.users.findIndex(u => u.id === userId);
        
        if (userIndex === -1) {
          return { error: { message: 'User not found' } };
        }
        
        // Update user data
        dataStore.users[userIndex] = { 
          ...dataStore.users[userIndex],
          ...data
        };
        
        // Update session user
        const updatedSessionUser = { ...dataStore.users[userIndex] };
        delete updatedSessionUser.password;
        dataStore.currentUser = { user: updatedSessionUser };
        
        // Save changes
        await saveToStorage(STORAGE_KEYS.USERS, dataStore.users);
        await saveToStorage(STORAGE_KEYS.CURRENT_USER, dataStore.currentUser);
        
        return { 
          data: { user: updatedSessionUser },
          error: null 
        };
      } catch (error) {
        console.error('Error in updateUser:', error);
        return { error: { message: 'Failed to update user data' } };
      }
    }
  },
  
  // Database operations
  from: (table) => {
    return {
      select: (columns = '*') => {
        return {
          eq: (column, value) => {
            try {
              // Handle different tables
              switch (table) {
                case 'categories':
                  return {
                    order: (orderColumn, { ascending = true } = {}) => {
                      // Filter by user_id
                      const filtered = dataStore.categories.filter(c => c.user_id === value);
                      
                      // Sort by specified column
                      const sorted = [...filtered].sort((a, b) => {
                        if (orderColumn === 'name') {
                          return ascending 
                            ? a.name.localeCompare(b.name) 
                            : b.name.localeCompare(a.name);
                        }
                        return 0;
                      });
                      
                      return Promise.resolve({ data: sorted, error: null });
                    }
                  };
                  
                case 'quick_expenses':
                  return {
                    select: (innerJoin) => {
                      // Filter quick expenses by user_id
                      const filtered = dataStore.quickExpenses.filter(qe => qe.user_id === value);
                      
                      // Join with categories
                      const enriched = filtered.map(qe => {
                        const category = dataStore.categories.find(c => c.id === qe.category);
                        return {
                          ...qe,
                          categories: category || null
                        };
                      });
                      
                      return Promise.resolve({ data: enriched, error: null });
                    }
                  };
                  
                case 'expenses':
                  return {
                    order: (orderColumn, { ascending = true } = {}) => {
                      // Filter expenses by user_id
                      const filtered = dataStore.expenses.filter(e => e.user_id === value);
                      
                      // Sort by date
                      const sorted = [...filtered].sort((a, b) => {
                        if (orderColumn === 'date') {
                          return ascending 
                            ? new Date(a.date) - new Date(b.date) 
                            : new Date(b.date) - new Date(a.date);
                        }
                        return 0;
                      });
                      
                      return Promise.resolve({ data: sorted, error: null });
                    }
                  };
                  
                default:
                  return Promise.resolve({ data: [], error: null });
              }
            } catch (error) {
              console.error(`Error in select.eq for ${table}:`, error);
              return Promise.resolve({ 
                data: [],
                error: { message: `Error querying ${table}` } 
              });
            }
          }
        };
      },
      
      insert: (data) => {
        return {
          select: () => {
            return {
              single: async () => {
                try {
                  let newItem;
                  
                  switch (table) {
                    case 'categories':
                      newItem = { 
                        id: `cat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                        ...data 
                      };
                      dataStore.categories = [...dataStore.categories, newItem];
                      await saveToStorage(STORAGE_KEYS.CATEGORIES, dataStore.categories);
                      break;
                      
                    case 'expenses':
                      newItem = { 
                        id: `exp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                        ...data 
                      };
                      dataStore.expenses = [...dataStore.expenses, newItem];
                      await saveToStorage(STORAGE_KEYS.EXPENSES, dataStore.expenses);
                      break;
                      
                    case 'quick_expenses':
                      newItem = { 
                        id: `qe-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                        ...data 
                      };
                      dataStore.quickExpenses = [...dataStore.quickExpenses, newItem];
                      await saveToStorage(STORAGE_KEYS.QUICK_EXPENSES, dataStore.quickExpenses);
                      break;
                  }
                  
                  return { data: newItem, error: null };
                } catch (error) {
                  console.error(`Error inserting into ${table}:`, error);
                  return { 
                    data: null,
                    error: { message: `Failed to add ${table.slice(0, -1)}` } 
                  };
                }
              }
            };
          }
        };
      },
      
      delete: () => {
        return {
          eq: async (column, value) => {
            try {
              switch (table) {
                case 'categories':
                  dataStore.categories = dataStore.categories.filter(c => c.id !== value);
                  await saveToStorage(STORAGE_KEYS.CATEGORIES, dataStore.categories);
                  break;
                  
                case 'expenses':
                  dataStore.expenses = dataStore.expenses.filter(e => e.id !== value);
                  await saveToStorage(STORAGE_KEYS.EXPENSES, dataStore.expenses);
                  break;
                  
                case 'quick_expenses':
                  dataStore.quickExpenses = dataStore.quickExpenses.filter(qe => qe.id !== value);
                  await saveToStorage(STORAGE_KEYS.QUICK_EXPENSES, dataStore.quickExpenses);
                  break;
              }
              
              return { error: null };
            } catch (error) {
              console.error(`Error deleting from ${table}:`, error);
              return { error: { message: `Failed to delete ${table.slice(0, -1)}` } };
            }
          }
        };
      }
    };
  }
};