import { useState } from 'react';
import { ScrollView } from 'react-native';
import { DietPlan } from '../../components/plan/DietPlan';
import { WorkoutPlanView } from '../../components/plan/WorkoutPlanView';
import { Chip, H1, Wrap } from '../../components/ui';

type Section = 'diet' | 'workout';

export default function PlanScreen() {
  const [section, setSection] = useState<Section>('diet');
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <H1>Your plan</H1>
      <Wrap>
        <Chip label="Diet" selected={section === 'diet'} onPress={() => setSection('diet')} />
        <Chip label="Workout" selected={section === 'workout'} onPress={() => setSection('workout')} />
      </Wrap>
      {section === 'diet' ? <DietPlan /> : <WorkoutPlanView />}
    </ScrollView>
  );
}
