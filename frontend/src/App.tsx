import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import CreateRequest from './pages/CreateRequest';
import Feed from './pages/Feed';
import Inventory from './pages/Inventory';
import Profile from './pages/Profile';
import Onboarding from './pages/Onboarding';
import Signup from './pages/Signup';
import Login from './pages/Login';
import RequestDetail from './pages/RequestDetail';
import ChatScreen from './pages/ChatScreen';
import Transaction from './pages/Transaction';
import Rating from './pages/Rating';
import GearDetail from './pages/GearDetail';
import SearchResults from './pages/SearchResults';
import PrivateRoute from './components/PrivateRoute';

function App() {
  return (
    <Routes>
      {/* Auth screens */}
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      
      {/* Secured Screens inside PrivateRoute */}
      <Route element={<PrivateRoute />}>
        <Route path="/chat/:contextId" element={<ChatScreen />} />
        <Route path="/transaction" element={<Transaction />} />
        <Route path="/rating" element={<Rating />} />
        <Route path="/gear/:id" element={<GearDetail />} />
        
        {/* Screens inside the Layout/BottomNav flow */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="search" element={<SearchResults />} />
          <Route path="requests" element={<Feed />} />
          <Route path="requests/:id" element={<RequestDetail />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="profile" element={<Profile />} />
          <Route path="create-request" element={<CreateRequest />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
