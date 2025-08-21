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
import Settings from './components/settings';
import MatchConvo from './components/matchConvo';

function App() {
  return (
    <Router>
        <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/complete-profile" element={<CompleteProfile />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/conversations" element={<Conversations />} />
            <Route path="/conversation/:matchId" element={<MatchConvo />} />
            <Route path="/match" element={<Match />} />
        </Routes>
    </Router>
  );
}

export default App;
