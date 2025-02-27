import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Alert,
  Image,
  Share,
  ActivityIndicator,
  FlatList,
  LayoutAnimation,
  UIManager,
  Easing,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons, Ionicons, FontAwesome, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner-native';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get('window');

// Available icons for custom categories
const AVAILABLE_ICONS = [
  'food', 'coffee', 'bus', 'cart', 'lightbulb', 'account', 'home', 
  'movie', 'cellphone', 'doctor', 'school', 'book', 'dumbbell', 'gift',
  'car', 'taxi', 'train', 'airplane', 'wallet', 'bank', 'cake',
  'music', 'basketball', 'soccer', 'bike', 'pill', 'tshirt', 'cash',
  'heart', 'shopping', 'beach', 'church', 'credit-card', 'hotel',
  'laptop', 'printer', 'robot', 'tools', 'umbrella', 'wifi'
];

// Available colors for custom categories
const AVAILABLE_COLORS = [
  '#FF7043', '#795548', '#42A5F5', '#66BB6A', '#FFC107', '#AB47BC', '#78909C',
  '#EC407A', '#5C6BC0', '#26A69A', '#FFA726', '#8D6E63', '#7E57C2', '#EC7063',
  '#3498DB', '#45B39D', '#F4D03F', '#DC7633', '#CD6155', '#5499C7', '#52BE80',
  '#5D5FEF', '#00BFA5', '#FF5252', '#FF4081', '#7C4DFF', '#448AFF', '#FF6E40'
];

export default function DailyExpenseTracker() {
  // Authentication state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Main state
  const [expenses, setExpenses] = useState([]);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [activeTab, setActiveTab] = useState('add');
  
  // Category management state
  const [categories, setCategories] = useState([]);
  const [quickExpenses, setQuickExpenses] = useState([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('food');
  const [selectedColor, setSelectedColor] = useState('#FF7043');
  
  // Budget tracking state
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [currentBudget, setCurrentBudget] = useState(null);
  
  // Data visualization state
  const [showingDateRange, setShowingDateRange] = useState('week'); // 'week', 'month', 'year'
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  
  // Animation state
  const fadeAnim = useState(new Animated.Value(1))[0];
  const slideAnim = useState(new Animated.Value(0))[0];
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;  // Animation for dashboard elements
  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true
    }).start();
    
    Animated.timing(rotateAnim, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true
    }).start();
  }, []);
  
  // Check if user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error checking session:', error.message);
          setLoading(false);
          return;
        }
        
        if (data?.session) {
          const userData = data.session.user;
          setCurrentUser(userData);
          setIsLoggedIn(true);
          // Load user data (categories, expenses, etc.)
          await loadUserData(userData.id);
        }
      } catch (error) {
        console.error('Session check error:', error.message);
      } finally {
        setLoading(false);
      }
    };
    
    checkSession();
  }, []);
  
  // Calculate category breakdown whenever expenses change
  useEffect(() => {
    calculateCategoryBreakdown();
  }, [expenses, categories]);  const calculateCategoryBreakdown = () => {
    const categoryTotals = {};
    let totalSpent = 0;
    
    // Calculate total spending per category
    expenses.forEach(expense => {
      if (!categoryTotals[expense.category]) {
        categoryTotals[expense.category] = 0;
      }
      categoryTotals[expense.category] += expense.amount;
      totalSpent += expense.amount;
    });
    
    // Convert to percentage and format for display
    const breakdownData = Object.keys(categoryTotals).map(categoryId => {
      const category = categories.find(c => c.id === categoryId);
      const percentage = totalSpent > 0 ? (categoryTotals[categoryId] / totalSpent * 100) : 0;
      
      return {
        id: categoryId,
        name: category ? category.name : 'Unknown',
        color: category ? category.color : '#999',
        icon: category ? category.icon : 'help-circle',
        amount: categoryTotals[categoryId],
        percentage: percentage
      };
    }).sort((a, b) => b.amount - a.amount);
    
    setCategoryBreakdown(breakdownData);
  };

  // Load user data from Supabase
  const loadUserData = async (userId) => {
    try {
      // Load categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)
        .order('name');
        
      if (categoriesError) {
        console.error('Error loading categories:', categoriesError.message);
        toast.error('Failed to load categories');
        return;
      }
      
      if (categoriesData && categoriesData.length > 0) {
        setCategories(categoriesData);
        setSelectedCategory(categoriesData[0].id);
      }
      
      // Load quick expenses
      const { data: quickExpensesData, error: quickExpensesError } = await supabase
        .from('quick_expenses')
        .select('*, categories!inner(*)')
        .eq('user_id', userId);
        
      if (quickExpensesError) {
        console.error('Error loading quick expenses:', quickExpensesError.message);
        toast.error('Failed to load quick expenses');
        return;
      }
      
      if (quickExpensesData) {
        const formattedQuickExpenses = quickExpensesData.map(qe => ({
          id: qe.id,
          amount: parseFloat(qe.amount),
          name: qe.name,
          category: qe.categories.id
        }));
        setQuickExpenses(formattedQuickExpenses);
      }
      
      // Load expenses
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });
        
      if (expensesError) {
        console.error('Error loading expenses:', expensesError.message);
        toast.error('Failed to load expenses');
        return;
      }
      
      if (expensesData) {
        const formattedExpenses = expensesData.map(expense => ({
          id: expense.id,
          amount: parseFloat(expense.amount),
          note: expense.note,
          category: expense.category_id,
          date: new Date(expense.date)
        }));
        setExpenses(formattedExpenses);
      }
    } catch (error) {
      console.error('Error loading user data:', error.message);
      toast.error('Failed to load data');
    }
  };

  // Authentication functions
  const handleLogin = async () => {
    if (!email || !password) {
      toast.error('Please enter both email and password');
      return;
    }
    
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        toast.error(error.message);
        return;
      }
      
      if (data?.user) {
        setCurrentUser(data.user);
        setIsLoggedIn(true);
        setShowLogin(false);
        
        // Load user data
        await loadUserData(data.user.id);
        
        // Reset form
        setEmail('');
        setPassword('');
        
        toast.success('Logged in successfully!');
      }
    } catch (error) {
      console.error('Login error:', error.message);
      toast.error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!email || !password || !confirmPassword || !name) {
      toast.error('Please fill in all fields');
      return;
    }
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email');
      return;
    }
    
    try {
      setLoading(true);
      
      // Sign up the user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      });
      
      if (error) {
        toast.error(error.message);
        return;
      }
      
      if (data?.user) {
        // Update user metadata (name)
        const { error: updateError } = await supabase.auth.updateUser({
          data: { full_name: name }
        });
        
        if (updateError) {
          console.error('Error updating user metadata:', updateError.message);
        }
        
        setCurrentUser(data.user);
        setIsLoggedIn(true);
        setShowSignup(false);
        
        // Reset form
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setName('');
        
        // The trigger will automatically create default categories
        // Load user data
        await loadUserData(data.user.id);
        
        toast.success('Account created successfully!');
      }
    } catch (error) {
      console.error('Signup error:', error.message);
      toast.error('Registration failed');
    } finally {
      setLoading(false);
    }
  };  const handleLogout = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Logout error:', error.message);
        toast.error('Logout failed');
        return;
      }
      
      setIsLoggedIn(false);
      setCurrentUser(null);
      setExpenses([]);
      setCategories([]);
      setQuickExpenses([]);
      setSelectedCategory(null);
      
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error.message);
      toast.error('Logout failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async () => {
    if (!amount || isNaN(parseFloat(amount)) || !selectedCategory) {
      toast.error('Please enter a valid amount and select a category');
      return;
    }
    
    try {
      setLoading(true);
      
      const expenseData = {
        user_id: currentUser.id,
        amount: parseFloat(amount),
        note: note || 'Expense',
        category_id: selectedCategory,
        date: new Date().toISOString(),
      };
      
      const { data, error } = await supabase
        .from('expenses')
        .insert(expenseData)
        .select()
        .single();
        
      if (error) {
        console.error('Error adding expense:', error.message);
        toast.error('Failed to add expense');
        return;
      }
      
      const newExpense = {
        id: data.id,
        amount: parseFloat(data.amount),
        note: data.note,
        category: data.category_id,
        date: new Date(data.date),
      };
      
      animateAddition();
      
      setExpenses([newExpense, ...expenses]);
      setAmount('');
      setNote('');
      
      toast.success('Expense added successfully');
    } catch (error) {
      console.error('Add expense error:', error.message);
      toast.error('Failed to add expense');
    } finally {
      setLoading(false);
    }
  };
  
  const handleQuickExpense = async (quickExpense) => {
    try {
      setLoading(true);
      
      const expenseData = {
        user_id: currentUser.id,
        amount: quickExpense.amount,
        note: quickExpense.name,
        category_id: quickExpense.category,
        date: new Date().toISOString(),
      };
      
      const { data, error } = await supabase
        .from('expenses')
        .insert(expenseData)
        .select()
        .single();
        
      if (error) {
        console.error('Error adding quick expense:', error.message);
        toast.error('Failed to add expense');
        return;
      }
      
      const newExpense = {
        id: data.id,
        amount: parseFloat(data.amount),
        note: data.note,
        category: data.category_id,
        date: new Date(data.date),
      };
      
      animateAddition();
      
      setExpenses([newExpense, ...expenses]);
      
      toast.success('Expense added successfully');
    } catch (error) {
      console.error('Add quick expense error:', error.message);
      toast.error('Failed to add expense');
    } finally {
      setLoading(false);
    }
  };
  
  const animateAddition = () => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.6,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    
    Animated.timing(slideAnim, {
      toValue: -10,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }).start();
    });
  };  const handleDeleteExpense = async (id) => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);
        
      if (error) {
        console.error('Error deleting expense:', error.message);
        toast.error('Failed to delete expense');
        return;
      }
      
      setExpenses(expenses.filter(expense => expense.id !== id));
      toast.success('Expense deleted successfully');
    } catch (error) {
      console.error('Delete expense error:', error.message);
      toast.error('Failed to delete expense');
    } finally {
      setLoading(false);
    }
  };
  
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Please enter a category name');
      return;
    }
    
    try {
      setLoading(true);
      
      const categoryData = {
        user_id: currentUser.id,
        name: newCategoryName.trim(),
        icon: selectedIcon,
        color: selectedColor,
      };
      
      const { data, error } = await supabase
        .from('categories')
        .insert(categoryData)
        .select()
        .single();
        
      if (error) {
        console.error('Error adding category:', error.message);
        toast.error('Failed to add category');
        return;
      }
      
      const newCategory = {
        id: data.id,
        name: data.name,
        icon: data.icon,
        color: data.color,
        user_id: data.user_id,
      };
      
      setCategories([...categories, newCategory]);
      setSelectedCategory(newCategory.id);
      
      // Reset form
      setNewCategoryName('');
      setSelectedIcon('food');
      setSelectedColor('#FF7043');
      setShowAddCategory(false);
      
      toast.success('Category added successfully');
    } catch (error) {
      console.error('Add category error:', error.message);
      toast.error('Failed to add category');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteCategory = async (categoryId) => {
    try {
      // Check if there are expenses with this category
      const expensesWithCategory = expenses.filter(expense => expense.category === categoryId);
      
      if (expensesWithCategory.length > 0) {
        toast.error('This category has expenses. Please delete those expenses first or reassign them to another category.');
        return;
      }
      
      setLoading(true);
      
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId);
        
      if (error) {
        console.error('Error deleting category:', error.message);
        toast.error('Failed to delete category');
        return;
      }
      
      setCategories(categories.filter(category => category.id !== categoryId));
      
      // If the deleted category was selected, select the first available category
      if (selectedCategory === categoryId && categories.length > 0) {
        setSelectedCategory(categories[0].id);
      }
      
      toast.success('Category deleted successfully');
    } catch (error) {
      console.error('Delete category error:', error.message);
      toast.error('Failed to delete category');
    } finally {
      setLoading(false);
    }
  };
  
  const getTodayExpenses = () => {
    const today = new Date();
    return expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return (
        expenseDate.getDate() === today.getDate() &&
        expenseDate.getMonth() === today.getMonth() &&
        expenseDate.getFullYear() === today.getFullYear()
      );
    });
  };

  const totalToday = getTodayExpenses().reduce((sum, expense) => sum + expense.amount, 0);  const getCategoryIcon = (categoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.icon : 'help-circle';
  };
  
  const getCategoryColor = (categoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.color : '#888';
  };
  
  const getCategoryName = (categoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : 'Unknown';
  };
  
  const formatDate = (date) => {
    const now = new Date();
    const expenseDate = new Date(date);
    
    if (expenseDate.toDateString() === now.toDateString()) {
      return 'Today';
    } else if (
      expenseDate.getDate() === now.getDate() - 1 &&
      expenseDate.getMonth() === now.getMonth() &&
      expenseDate.getFullYear() === now.getFullYear()
    ) {
      return 'Yesterday';
    } else {
      return expenseDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // Render authentication screens
  const renderWelcomeScreen = () => (
    <View style={styles.authContainer}>
      <View style={styles.logoContainer}>
        <MaterialCommunityIcons name="wallet-outline" size={80} color="#5D5FEF" />
        <Text style={styles.logoText}>ExpenseTracker</Text>
        <Text style={styles.logoSubtext}>Manage your daily expenses with ease</Text>
      </View>
      
      <Image 
        source={{ uri: "https://api.a0.dev/assets/image?text=saving%20money%20expense%20tracking%20app&aspect=16:9" }} 
        style={styles.welcomeImage} 
      />
      
      <View style={styles.authButtonContainer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => setShowLogin(true)}
        >
          <Text style={styles.primaryButtonText}>Log In</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => setShowSignup(true)}
        >
          <Text style={styles.secondaryButtonText}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  
  const renderLoginScreen = () => (
    <Modal
      visible={showLogin}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowLogin(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.authModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Log In</Text>
            <TouchableOpacity onPress={() => setShowLogin(false)}>
              <MaterialIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.authForm}>
            <View style={styles.authInputContainer}>
              <MaterialIcons name="email" size={20} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.authInput}
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor="#AAAAAA"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            
            <View style={styles.authInputContainer}>
              <MaterialIcons name="lock" size={20} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.authInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor="#AAAAAA"
                secureTextEntry
              />
            </View>
            
            <TouchableOpacity
              style={[styles.primaryButton, { marginTop: 24 }]}
              onPress={handleLogin}
            >
              <Text style={styles.primaryButtonText}>Log In</Text>
            </TouchableOpacity>
            
            <View style={styles.authFooter}>
              <Text style={styles.authFooterText}>Don't have an account? </Text>
              <TouchableOpacity 
                onPress={() => {
                  setShowLogin(false);
                  setShowSignup(true);
                }}
              >
                <Text style={styles.authFooterLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
  
  const renderSignupScreen = () => (
    <Modal
      visible={showSignup}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowSignup(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.authModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create Account</Text>
            <TouchableOpacity onPress={() => setShowSignup(false)}>
              <MaterialIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.authForm}>
            <View style={styles.authInputContainer}>
              <MaterialIcons name="person" size={20} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.authInput}
                value={name}
                onChangeText={setName}
                placeholder="Full Name"
                placeholderTextColor="#AAAAAA"
              />
            </View>
            
            <View style={styles.authInputContainer}>
              <MaterialIcons name="email" size={20} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.authInput}
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor="#AAAAAA"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            
            <View style={styles.authInputContainer}>
              <MaterialIcons name="lock" size={20} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.authInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor="#AAAAAA"
                secureTextEntry
              />
            </View>
            
            <View style={styles.authInputContainer}>
              <MaterialIcons name="lock-outline" size={20} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.authInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm Password"
                placeholderTextColor="#AAAAAA"
                secureTextEntry
              />
            </View>
            
            <TouchableOpacity
              style={[styles.primaryButton, { marginTop: 24 }]}
              onPress={handleSignup}
            >
              <Text style={styles.primaryButtonText}>Sign Up</Text>
            </TouchableOpacity>
            
            <View style={styles.authFooter}>
              <Text style={styles.authFooterText}>Already have an account? </Text>
              <TouchableOpacity 
                onPress={() => {
                  setShowSignup(false);
                  setShowLogin(true);
                }}
              >
                <Text style={styles.authFooterLink}>Log In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Category creation modal
  const renderCategoryModal = () => (
    <Modal
      visible={showAddCategory}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowAddCategory(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create New Category</Text>
            <TouchableOpacity onPress={() => setShowAddCategory(false)}>
              <MaterialIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.inputLabel}>Category Name</Text>
          <TextInput
            style={styles.modalInput}
            value={newCategoryName}
            onChangeText={setNewCategoryName}
            placeholder="e.g., Entertainment, Education"
            placeholderTextColor="#AAAAAA"
          />
          
          <Text style={styles.inputLabel}>Select Icon</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconSelector}>
            {AVAILABLE_ICONS.map((icon) => (
              <TouchableOpacity
                key={icon}
                style={[
                  styles.iconButton,
                  selectedIcon === icon && { backgroundColor: selectedColor + '40', borderColor: selectedColor }
                ]}
                onPress={() => setSelectedIcon(icon)}
              >
                <MaterialCommunityIcons name={icon} size={24} color={selectedIcon === icon ? selectedColor : '#777'} />
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          <Text style={styles.inputLabel}>Select Color</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorSelector}>
            {AVAILABLE_COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorButton,
                  { backgroundColor: color },
                  selectedColor === color && { borderWidth: 2, borderColor: '#333' }
                ]}
                onPress={() => setSelectedColor(color)}
              />
            ))}
          </ScrollView>
          
          <TouchableOpacity
            style={[styles.addButton, { marginTop: 20 }]}
            onPress={handleAddCategory}
          >
            <Text style={styles.addButtonText}>Create Category</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );  if (loading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#5D5FEF" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }
  
  if (!isLoggedIn) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          {renderWelcomeScreen()}
          {renderLoginScreen()}
          {renderSignupScreen()}
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }  // Function to generate expense report to share
  const generatePDFReport = async () => {
    try {
      // Format the current date
      const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      // Create report content as a text string
      let reportContent = `EXPENSE REPORT\n`;
      reportContent += `===================================\n\n`;
      reportContent += `Generated on: ${currentDate}\n`;
      reportContent += `User: ${currentUser?.name || 'User'}\n\n`;
      
      // Add today's expenses
      reportContent += `TODAY'S EXPENSES\n`;
      reportContent += `===================================\n`;
      reportContent += `Total: ₹${totalToday.toFixed(2)}\n\n`;
      
      if (getTodayExpenses().length > 0) {
        getTodayExpenses().forEach(expense => {
          const category = getCategoryName(expense.category);
          reportContent += `• ${expense.note} (${category}): ₹${expense.amount.toFixed(2)}\n`;
        });
      } else {
        reportContent += `No expenses recorded today.\n`;
      }
      
      reportContent += `\n`;
      
      // Add previous expenses grouped by date
      reportContent += `PREVIOUS EXPENSES\n`;
      reportContent += `===================================\n`;
      
      const previousExpenses = expenses.filter(e => !getTodayExpenses().includes(e));
      
      if (previousExpenses.length > 0) {
        const groupedByDate = {};
        
        previousExpenses.forEach(expense => {
          const date = new Date(expense.date);
          const dateKey = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });
          
          if (!groupedByDate[dateKey]) {
            groupedByDate[dateKey] = [];
          }
          groupedByDate[dateKey].push(expense);
        });
        
        Object.keys(groupedByDate).sort((a, b) => {
          // Sort dates in descending order (newest first)
          return new Date(b) - new Date(a);
        }).forEach(date => {
          const dayTotal = groupedByDate[date].reduce((sum, exp) => sum + exp.amount, 0);
          reportContent += `\n${date} - Total: ₹${dayTotal.toFixed(2)}\n`;
          reportContent += `-----------------------------------\n`;
          
          groupedByDate[date].forEach(expense => {
            const category = getCategoryName(expense.category);
            reportContent += `• ${expense.note} (${category}): ₹${expense.amount.toFixed(2)}\n`;
          });
        });
      } else {
        reportContent += `No previous expenses recorded.\n`;
      }
      
      // Calculate and add category breakdown
      reportContent += `\nCATEGORY BREAKDOWN\n`;
      reportContent += `===================================\n`;
      
      const categoryTotals = {};
      expenses.forEach(expense => {
        if (!categoryTotals[expense.category]) {
          categoryTotals[expense.category] = 0;
        }
        categoryTotals[expense.category] += expense.amount;
      });
      
      const totalExpenses = Object.values(categoryTotals).reduce((sum, amount) => sum + amount, 0);
      
      // Sort categories by amount (highest first)
      const sortedCategories = Object.keys(categoryTotals).sort((a, b) => {
        return categoryTotals[b] - categoryTotals[a];
      });
      
      sortedCategories.forEach(catId => {
        const percentage = totalExpenses > 0 ? (categoryTotals[catId] / totalExpenses * 100).toFixed(1) : 0;
        reportContent += `• ${getCategoryName(catId)}: ₹${categoryTotals[catId].toFixed(2)} (${percentage}%)\n`;
      });
      
      // Add a summary at the end
      reportContent += `\nSUMMARY\n`;
      reportContent += `===================================\n`;
      reportContent += `Total Expenses: ₹${totalExpenses.toFixed(2)}\n`;
      reportContent += `Number of Transactions: ${expenses.length}\n`;
      
      if (expenses.length > 0) {
        const avgExpense = totalExpenses / expenses.length;
        reportContent += `Average Expense: ₹${avgExpense.toFixed(2)}\n`;
        
        // Find highest expense
        const highestExpense = expenses.reduce((max, expense) => 
          expense.amount > max.amount ? expense : max, expenses[0]);
        
        reportContent += `Highest Expense: ₹${highestExpense.amount.toFixed(2)} (${highestExpense.note})\n`;
      }
      
      reportContent += `\n-----------------------------------\n`;
      reportContent += `Generated by Daily Expense Tracker\n`;
      
      // Use the Share API to share the report as a text file
      await Share.share({
        message: reportContent,
        title: "Expense Report",
      });
      
      Alert.alert(
        "Report Generated", 
        "Your expense report has been generated and is ready to share!",
        [{ text: "OK" }]
      );
    } catch (error) {
      Alert.alert("Error", "Could not generate report: " + error.message);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Daily Expenses</Text>
            <View style={styles.headerButtons}>
              <TouchableOpacity onPress={generatePDFReport} style={styles.pdfButton}>
                <MaterialIcons name="picture-as-pdf" size={22} color="#666" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
                <MaterialIcons name="exit-to-app" size={24} color="#666" />
              </TouchableOpacity>
            </View>
          </View>
          
          <Animated.View 
            style={[
              styles.summaryCard, 
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}
          >
            <View style={styles.summaryContent}>
              <View style={styles.summaryUserInfo}>
                <Text style={styles.welcomeText}>
                  Welcome, {currentUser?.name || 'User'}!
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Today's Total</Text>
                <Text style={styles.summaryAmount}>₹{totalToday.toFixed(2)}</Text>
              </View>
            </View>
          </Animated.View>

          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'add' && styles.activeTab]}
              onPress={() => setActiveTab('add')}
            >
              <MaterialIcons 
                name="add-circle-outline" 
                size={22} 
                color={activeTab === 'add' ? '#5D5FEF' : '#A0A0A0'} 
              />
              <Text style={[styles.tabText, activeTab === 'add' && styles.activeTabText]}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'history' && styles.activeTab]}
              onPress={() => setActiveTab('history')}
            >
              <MaterialIcons 
                name="history" 
                size={22} 
                color={activeTab === 'history' ? '#5D5FEF' : '#A0A0A0'} 
              />
              <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>History</Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'add' ? (
            <View style={styles.inputContainer}>
              <View style={styles.amountContainer}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  placeholderTextColor="#BBBBBB"
                />
              </View>
              
              <View style={styles.noteContainer}>
                <TextInput
                  style={styles.noteInput}
                  value={note}
                  onChangeText={setNote}
                  placeholder="What was it for?"
                  placeholderTextColor="#BBBBBB"
                />
              </View>
              
              <View style={styles.categoryLabelRow}>
                <Text style={styles.categoryLabel}>Category</Text>
                <TouchableOpacity
                  style={styles.addCategoryButton}
                  onPress={() => setShowAddCategory(true)}
                >
                  <MaterialIcons name="add" size={18} color="#5D5FEF" />
                  <Text style={styles.addCategoryText}>New Category</Text>
                </TouchableOpacity>
              </View>
              
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.categoryContainer}
              >
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryButton,
                      selectedCategory === category.id && {
                        backgroundColor: category.color + '20',
                        borderColor: category.color,
                      },
                    ]}
                    onPress={() => setSelectedCategory(category.id)}
                  >
                    <MaterialCommunityIcons
                      name={category.icon}
                      size={20}
                      color={category.color}
                    />
                    <Text style={[
                      styles.categoryText,
                      selectedCategory === category.id && { color: category.color }
                    ]}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddExpense}
              >
                <Text style={styles.addButtonText}>Add Expense</Text>
              </TouchableOpacity>
              
              <View style={styles.quickAddContainer}>
                <Text style={styles.quickAddLabel}>Quick Add</Text>
                <View style={styles.quickExpensesContainer}>
                  {quickExpenses.map((expense, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.quickExpenseButton}
                      onPress={() => handleQuickExpense(expense)}
                    >
                      <View style={[styles.quickExpenseIcon, { backgroundColor: getCategoryColor(expense.category) + '30' }]}>
                        <MaterialCommunityIcons
                          name={getCategoryIcon(expense.category)}
                          size={16}
                          color={getCategoryColor(expense.category)}
                        />
                      </View>
                      <Text style={styles.quickExpenseName}>{expense.name}</Text>
                      <Text style={styles.quickExpenseAmount}>₹{expense.amount}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          ) : (
            <ScrollView style={styles.historyContainer}>
              <View style={styles.todayHeader}>
                <Text style={styles.todayHeaderText}>Today's Expenses</Text>
                <Text style={styles.todayTotalText}>Total: ₹{totalToday.toFixed(2)}</Text>
              </View>
              
              {getTodayExpenses().length > 0 ? (
                getTodayExpenses().map((expense) => (
                  <View key={expense.id} style={styles.expenseItem}>
                    <View style={[styles.expenseIconContainer, { backgroundColor: getCategoryColor(expense.category) + '20' }]}>
                      <MaterialCommunityIcons
                        name={getCategoryIcon(expense.category)}
                        size={24}
                        color={getCategoryColor(expense.category)}
                      />
                    </View>
                    <View style={styles.expenseDetails}>
                      <View style={styles.expenseNameRow}>
                        <Text style={styles.expenseName}>{expense.note}</Text>
                        <Text style={styles.expenseCategory}>{getCategoryName(expense.category)}</Text>
                      </View>
                      <View style={styles.expenseTimeRow}>
                        <Text style={styles.expenseTime}>{formatDate(expense.date)}</Text>
                        <Text style={styles.expenseAmount}>₹{expense.amount.toFixed(2)}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteExpense(expense.id)}
                    >
                      <MaterialIcons name="delete-outline" size={20} color="#FF5252" />
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="cash-remove" size={60} color="#ddd" />
                  <Text style={styles.emptyStateText}>No expenses today</Text>
                  <Text style={styles.emptyStateSubtext}>
                    Add your first expense using the "Add" tab
                  </Text>
                </View>
              )}
              
              <View style={styles.pastHeader}>
                <Text style={styles.pastHeaderText}>Previous Expenses</Text>
              </View>
              
              {expenses.filter(e => !getTodayExpenses().includes(e)).length > 0 ? (
                expenses
                  .filter(e => !getTodayExpenses().includes(e))
                  .map((expense) => (
                    <View key={expense.id} style={styles.expenseItem}>
                      <View style={[styles.expenseIconContainer, { backgroundColor: getCategoryColor(expense.category) + '20' }]}>
                        <MaterialCommunityIcons
                          name={getCategoryIcon(expense.category)}
                          size={24}
                          color={getCategoryColor(expense.category)}
                        />
                      </View>
                      <View style={styles.expenseDetails}>
                        <View style={styles.expenseNameRow}>
                          <Text style={styles.expenseName}>{expense.note}</Text>
                          <Text style={styles.expenseCategory}>{getCategoryName(expense.category)}</Text>
                        </View>
                        <View style={styles.expenseTimeRow}>
                          <Text style={styles.expenseTime}>{formatDate(expense.date)}</Text>
                          <Text style={styles.expenseAmount}>₹{expense.amount.toFixed(2)}</Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteExpense(expense.id)}
                      >
                        <MaterialIcons name="delete-outline" size={20} color="#FF5252" />
                      </TouchableOpacity>
                    </View>
                  ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateSubtext}>
                    No previous expenses
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
          
          {/* Render the category creation modal */}
          {renderCategoryModal()}
          
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F9FC',
  },
  loadingText: {
    marginTop: 10,
    color: '#5D5FEF',
    fontSize: 16,
  },
  container: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pdfButton: {
    padding: 5,
    marginRight: 10,
  },
  logoutButton: {
    padding: 5,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    paddingVertical: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingVertical: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#5D5FEF',
  },
  tabText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#A0A0A0',
  },
  activeTabText: {
    color: '#5D5FEF',
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
    overflow: 'hidden',
    padding: 16,
  },
  summaryContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryUserInfo: {
    marginBottom: 10,
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#5D5FEF',
  },
  summaryItem: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
  },
  inputContainer: {
    flex: 1,
    padding: 16,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '500',
    color: '#333',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    color: '#333',
    padding: 14,
  },
  noteContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  noteInput: {
    padding: 14,
    fontSize: 15,
    color: '#333',
  },
  categoryLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
  },
  addCategoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: '#EEF0FF',
  },
  addCategoryText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#5D5FEF',
    marginLeft: 2,
  },
  categoryContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryText: {
    marginLeft: 6,
    fontSize: 13,
    color: '#666',
  },
  addButton: {
    backgroundColor: '#5D5FEF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  quickAddContainer: {
    marginBottom: 20,
  },
  quickAddLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 10,
  },
  quickExpensesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickExpenseButton: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  quickExpenseIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  quickExpenseName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  quickExpenseAmount: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  historyContainer: {
    flex: 1,
    padding: 16,
  },
  todayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  todayHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  todayTotalText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#5D5FEF',
  },
  pastHeader: {
    marginTop: 24,
    marginBottom: 12,
  },
  pastHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  expenseItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EEE',
    alignItems: 'center',
  },
  expenseIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  expenseDetails: {
    flex: 1,
  },
  expenseNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  expenseName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  expenseCategory: {
    fontSize: 12,
    color: '#888',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  expenseTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  expenseTime: {
    fontSize: 12,
    color: '#999',
  },
  expenseAmount: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  deleteButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#888',
  },
  emptyStateSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#AAA',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  // Category modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    marginBottom: 16,
  },
  iconSelector: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  iconButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  colorSelector: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  colorButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  // Authentication styles
  authContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  logoSubtext: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  welcomeImage: {
    width: width - 40,
    height: 180,
    borderRadius: 16,
    marginBottom: 40,
  },
  authButtonContainer: {
    width: '100%',
  },
  primaryButton: {
    backgroundColor: '#5D5FEF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#5D5FEF',
  },
  secondaryButtonText: {
    color: '#5D5FEF',
    fontSize: 16,
    fontWeight: '600',
  },
  authModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 450,
  },
  authForm: {
    marginTop: 20,
  },
  authInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    backgroundColor: '#fff',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 10,
  },
  authInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    padding: 14,
  },
  authFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  authFooterText: {
    color: '#666',
    fontSize: 14,
  },
  authFooterLink: {
    color: '#5D5FEF',
    fontSize: 14,
    fontWeight: '500',
  },
});