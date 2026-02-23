import React, { useEffect, useState, useContext } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import brLocale from "date-fns/locale/pt-BR";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import {
  Button,
  Grid,
  TextField,
  Box,
  Typography,
  CircularProgress,
  Chip,
  Divider
} from "@mui/material";
import api from "../../services/api";
import { format } from "date-fns";
import { toast } from "react-toastify";
import { useTheme as useThemeV5, alpha } from "@mui/material/styles";
import { useTheme as useThemeV4 } from "@material-ui/core/styles";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export const ChatsUser = () => {
  const themeV5 = useThemeV5(); // ✅ agora existe
  const themeV4 = useThemeV4();

  const PRIMARY_MAIN = themeV4?.palette?.primary?.main || "#1976d2";
  const PRIMARY_DARK = themeV4?.palette?.primary?.dark || "#115293";
  const PRIMARY_CONTRAST = themeV4?.palette?.primary?.contrastText || "#fff";

  // 📅 período padrão = mês atual
  const [initialDate, setInitialDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [finalDate, setFinalDate] = useState(new Date());

  const [ticketsData, setTicketsData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const { user } = useContext(AuthContext);
  const companyId = user.companyId;

  const handleGetTicketsInformation = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get(
        `/dashboard/ticketsUsers?initialDate=${format(initialDate, "yyyy-MM-dd")}&finalDate=${format(finalDate, "yyyy-MM-dd")}&companyId=${companyId}`
      );
      setTicketsData(data?.data || []);
    } catch {
      toast.error("Erro ao buscar informações dos tickets");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) handleGetTicketsInformation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const labels = ticketsData.map(item => item.nome);
  const values = ticketsData.map(item => item.quantidade);

  const dataCharts = {
    labels,
    datasets: [
      {
        label: "Tickets",
        data: values,
        backgroundColor: alpha(PRIMARY_MAIN, 0.55),
        borderRadius: 10,
        barThickness: 26,
        hoverBackgroundColor: PRIMARY_MAIN,
      }
    ]
  };

  const options = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: themeV5.palette.background.paper,
        titleColor: themeV5.palette.text.primary,
        bodyColor: themeV5.palette.text.secondary,
        borderColor: themeV5.palette.divider,
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: ctx => `${ctx.parsed.x} tickets`
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: alpha(themeV5.palette.text.primary, 0.08) },
        ticks: { color: themeV5.palette.text.secondary }
      },
      y: {
        grid: { display: false },
        ticks: { color: themeV5.palette.text.secondary }
      }
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
        <Box>
          <Typography variant="h6" fontWeight={950}>
            {i18n.t("dashboard.charts.userPerformance")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Tickets por atendente no período
          </Typography>
        </Box>

        <Chip
          label={`${labels.length} atendentes`}
          sx={{
            bgcolor: alpha(PRIMARY_MAIN, 0.12),
            color: PRIMARY_MAIN,
            fontWeight: 950,
            border: `1px solid ${alpha(PRIMARY_MAIN, 0.18)}`
          }}
        />
      </Box>

      <Divider sx={{ mb: 2.5 }} />

      <Grid container spacing={2} alignItems="center" sx={{ mb: 2.5 }}>
        <Grid item xs={12} sm={6} md={4}>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={brLocale}>
            <DatePicker
              value={initialDate}
              onChange={setInitialDate}
              label={i18n.t("dashboard.date.initialDate")}
              renderInput={params => <TextField {...params} fullWidth size="small" />}
            />
          </LocalizationProvider>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={brLocale}>
            <DatePicker
              value={finalDate}
              onChange={setFinalDate}
              label={i18n.t("dashboard.date.finalDate")}
              renderInput={params => <TextField {...params} fullWidth size="small" />}
            />
          </LocalizationProvider>
        </Grid>

        <Grid item xs={12} md>
          <Button
            onClick={handleGetTicketsInformation}
            variant="contained"
            fullWidth
            disabled={isLoading}
            sx={{
              backgroundColor: PRIMARY_MAIN,
              color: PRIMARY_CONTRAST,
              borderRadius: "12px",
              py: 1.05,
              fontWeight: 950,
              "&:hover": { backgroundColor: PRIMARY_DARK }
            }}
          >
            {isLoading ? <CircularProgress size={24} color="inherit" /> : i18n.t("dashboard.buttons.filter")}
          </Button>
        </Grid>
      </Grid>

      <Box
        sx={{
          height: 420,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: alpha(themeV5.palette.background.paper, 0.55),
          backdropFilter: "blur(8px)",
          p: 2
        }}
      >
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
            <CircularProgress />
          </Box>
        ) : values.length > 0 ? (
          <Bar options={options} data={dataCharts} />
        ) : (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
            <Typography color="text.secondary">Nenhum dado para exibir.</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ChatsUser;
