import { useNakama } from './context/NakamaContext';
import { HomeScreen } from './components/HomeScreen';
import { MatchmakingScreen } from './components/MatchmakingScreen';
import { CustomRoomScreen } from './components/CustomRoomScreen';
import { GameScreen } from './components/GameScreen';
import { LeaderboardScreen } from './components/LeaderboardScreen';

export function App() {
  const { screen } = useNakama();

  switch (screen) {
    case 'home':
      return <HomeScreen />;
    case 'matchmaking':
      return <MatchmakingScreen />;
    case 'custom_room':
      return <CustomRoomScreen />;
    case 'game':
      return <GameScreen />;
    case 'leaderboard':
      return <LeaderboardScreen />;
  }
}
