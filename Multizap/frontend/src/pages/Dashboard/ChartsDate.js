import React, { useEffect, useState, useContext } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import brLocale from "date-fns/locale/pt-BR";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import {
  Button,
  Grid,
  TextField,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Divider,
  Chip
} from "@mui/material";
import api from "../../services/api";
import { format } from "date-fns";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";

import { useTheme as useThemeV4 } from "@material-ui/core/styles";
import { useTheme as useThemeV5, alpha } from "@mui/material/styles";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export const ChartsDate = () => {
  const themeV5 = useThemeV5();
  const themeV4 = useThemeV4();

  const PRIMARY_MAIN = themeV4?.palette?.primary?.main || "#1976d2";
  const PRIMARY_DARK = themeV4?.palette?.primary?.dark || "#115293";
  const PRIMARY_CONTRAST = themeV4?.palette?.primary?.contrastText || "#fff";

  const [initialDate, setInitialDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [finalDate, setFinalDate] = useState(new Date());
  const [ticketsData, setTicketsData] = useState({ data: [], count: 0 });
  const [isLoading, setIsLoading] = useState(false);

  const { user } = useContext(AuthContext);
  const companyId = user.companyId;

  const handleGetTicketsInformation = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get(
        `/dashboard/ticketsDay?initialDate=${format(initialDate, "yyyy-MM-dd")}&finalDate=${format(finalDate, "yyyy-MM-dd")}&companyId=${companyId}`
      );
      setTicketsData(data);
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

  // ✅ labels sempre definidos
  const labels =
    ticketsData?.data?.length > 0
      ? ticketsData.data.map(item =>
          Object.prototype.hasOwnProperty.call(item, "horario")
            ? `${item.horario}:00`
            : item.data
        )
      : [];

  // ✅ dataCharts SEMPRE definido (zera tela branca)
  const dataCharts = {
    labels,
    datasets: [
      {
        label: "Tickets",
        data: ticketsData?.data?.length > 0 ? ticketsData.data.map(item => item.total) : [],

        borderColor: PRIMARY_MAIN,
        borderWidth: 3,
        tension: 0.45,

        fill: true,
        backgroundColor: alpha(PRIMARY_MAIN, 0.10),

        pointRadius: 4,
        pointHoverRadius: 6,
        pointBorderWidth: 2,
        pointBorderColor: PRIMARY_MAIN,
        pointBackgroundColor: themeV5.palette.background.paper,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: themeV5.palette.background.paper,
        titleColor: themeV5.palette.text.primary,
        bodyColor: themeV5.palette.text.secondary,
        borderColor: themeV5.palette.divider,
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          label: (ctx) => ` ${ctx.parsed.y} tickets`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: themeV5.palette.text.secondary },
      },
      y: {
        beginAtZero: true,
        grid: { color: alpha(themeV5.palette.text.primary, 0.08) },
        ticks: { color: themeV5.palette.text.secondary },
      },
    },
  };

  return (
    <Paper elevation={0} sx={{ p: 0, background: "transparent" }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          gap: 1.5,
          mb: 2
        }}
      >
        <Box>
          <Typography component="h2" variant="h6" fontWeight={950} color="text.primary">
            {i18n.t("dashboard.users.totalAttendances")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Tickets por período selecionado
          </Typography>
        </Box>

        <Chip
          label={i18n.t("dashboard.users.totalLabel", { count: ticketsData?.count || 0 })}
          sx={{
            bgcolor: alpha(PRIMARY_MAIN, 0.12),
            color: PRIMARY_MAIN,
            fontWeight: 950,
            border: `1px solid ${alpha(PRIMARY_MAIN, 0.18)}`
          }}
        />
      </Box>

      <Divider sx={{ my: 2.5 }} />

      <Grid container spacing={2} alignItems="center" sx={{ mb: 2.5 }}>
        <Grid item xs={12} sm={6} md={4}>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={brLocale}>
            <DatePicker
              value={initialDate}
              onChange={newValue => setInitialDate(newValue)}
              label={i18n.t("dashboard.date.initialDate")}
              renderInput={params => (
                <TextField {...params} fullWidth variant="outlined" size="small" />
              )}
            />
          </LocalizationProvider>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={brLocale}>
            <DatePicker
              value={finalDate}
              onChange={newValue => setFinalDate(newValue)}
              label={i18n.t("dashboard.date.finalDate")}
              renderInput={params => (
                <TextField {...params} fullWidth variant="outlined" size="small" />
              )}
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
              transition: "all .2s ease-in-out",
              borderRadius: "12px",
              py: 1.05,
              fontWeight: 950,
              letterSpacing: 0.6,
              "&:hover": {
                backgroundColor: PRIMARY_DARK,
                transform: "translateY(-1px)",
                boxShadow: "0 6px 18px rgba(0,0,0,.15)",
              }
            }}
          >
            {isLoading ? <CircularProgress size={24} color="inherit" /> : i18n.t("dashboard.buttons.filter")}
          </Button>
        </Grid>
      </Grid>

      <Box
        sx={{
          height: 360,
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
        ) : ticketsData?.data?.length === 0 ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
            <Typography color="text.secondary">Nenhum dado disponível para o período selecionado.</Typography>
          </Box>
        ) : (
          <Line options={options} data={dataCharts} />
        )}
      </Box>
    </Paper>
  );
};

export default ChartsDate;
