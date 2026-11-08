import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { NotFound } from './routes/NotFound';
import { Styleguide } from './routes/Styleguide';
import { Welcome } from './routes/Welcome';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/styleguide" element={<Styleguide />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
