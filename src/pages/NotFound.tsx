import { Link } from 'react-router';
import { DialogueBox } from '../components/dialogue/DialogueBox';
import { MenuPage } from '../components/shell/MenuPage';

export default function NotFound() {
  return (
    <MenuPage title="This room isn’t built yet">
      <DialogueBox text="Nothing lives at this address yet. The path back to the hall is right here." emote="attention" />
      <Link to="/" className="pixel-btn justify-self-start" data-variant="primary">
        ◀ Back to the hall
      </Link>
    </MenuPage>
  );
}
