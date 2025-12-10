import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

df = pd.read_csv('typestate_training_data.csv')

plt.figure(figsize=(10, 6))

# Plot the density of Flight Time Variance
sns.kdeplot(data=df[df['label'] == 0], x='flight_time_var', fill=True, color='green', label='Relaxed (Flow)')
sns.kdeplot(data=df[df['label'] == 1], x='flight_time_var', fill=True, color='red', label='Stressed (Cognitive Load)')

plt.title('Cognitive Load Signature: Keystroke Rhythm Variance')
plt.xlabel('Flight Time Variance (Rolling 5-key window)')
plt.xlim(0, 50000) # Trim outliers for better view
plt.legend()
plt.grid(True, alpha=0.3)

plt.savefig('stress_signature.png')
print("Graph saved as stress_signature.png")