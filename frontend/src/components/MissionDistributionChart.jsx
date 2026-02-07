import {
  Radar,
} from "react-chartjs-2";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from "chart.js";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip
);

export default function MissionDistributionChart({
  combat = 0,
  intel = 0,
  training = 0,
}) {
  const data = {
    labels: ["Combat", "R&D / Intel", "Training"],
    datasets: [
      {
        data: [combat, intel, training],
        backgroundColor: "rgba(56,189,248,0.18)",
        borderColor: "#38bdf8",
        borderWidth: 2,
        pointBackgroundColor: ["#ef4444", "#38bdf8", "#eab308"],
        pointRadius: 5,
      },
    ],
  };

  const options = {
    responsive: true,
    scales: {
      r: {
        suggestedMin: 0,
        suggestedMax: 100,
        ticks: { display: false },
        grid: { color: "rgba(255,255,255,0.1)" },
        angleLines: { color: "rgba(255,255,255,0.1)" },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.raw}%`,
        },
      },
    },
  };

  return <Radar data={data} options={options} />;
}