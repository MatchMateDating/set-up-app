import logo from './logo.svg';
import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/login';
import Profile from './components/profile';
import SignUp from './components/signUp';
import ProfilePage from './components/profilePage';
import Conversations from './components/conversations';
import Match from './components/match';
import CompleteProfile from './components/completeProfile';

function App() {
  return (
    <Router>
        <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/complete-profile" element={<CompleteProfile />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/conversations" element={<Conversations />} />
            <Route path="/match" element={<Match />} />
        </Routes>
    </Router>
  );
}

export default App;
