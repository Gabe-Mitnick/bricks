We're building an interactive explainer about how different brick patterns work. It will have interactive 3d models of different brick patterns. Let's design this mobile-first because most of our users will be on phones in portrait mode. We can worry about desktop later.

The explanation will be a series of steps. Each step will have text and a 3d model. But these won't be like separate slides — we'll build smooth transitions between the steps, and the 3d model will be visible at all times, just evolving as we go.

The layout for the webpage should involve these 3 layers:

1. The canvas
The background layer should be a canvas where we'll draw the 3d graphics. We'll usually place the graphics in the bottom half of the screen, but the canvas should cover the entire screen in case we want to have some graphics extend upward behind the text.

2. The text
The top half of the screen will have exlanatory text. When we transition to the next step, the text for the previous step should slide out to the left and the text for the new step should slide in from the right.

3. The controls
In the bottom right corner, we'll have a pair of "<" and ">" buttons for navigating forward and backward. On the first step, only the ">" button should be visible. On the last step, only the "<" button should be visible.
