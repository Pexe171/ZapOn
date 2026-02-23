import React, { useEffect } from 'react';
import toastError from "../../errors/toastError";

import { Button, Divider, Typography } from "@material-ui/core";
import RoomIcon from "@material-ui/icons/Room";

const LocationPreview = ({ image, link, description }) => {
	useEffect(() => { }, [image, link, description]);

	const handleLocation = async () => {
		try {
			if (!link) return;
			window.open(link);
		} catch (err) {
			toastError(err);
		}
	};

	const hasImage = Boolean(image && String(image).trim().length > 0);

	return (
		<>
			<div style={{ minWidth: "250px" }}>
				<div>
					<div style={{ float: "left" }}>
						{hasImage ? (
							<img
								src={image}
								alt="loc"
								onClick={handleLocation}
								style={{
									width: "100px",
									cursor: link ? "pointer" : "default",
									borderRadius: "6px"
								}}
								onError={(e) => {
									// fallback caso a imagem falhe
									e.currentTarget.style.display = "none";
								}}
							/>
						) : (
							<div
								onClick={handleLocation}
								style={{
									width: "100px",
									height: "70px",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									borderRadius: "6px",
									border: "1px solid rgba(0,0,0,0.12)",
									background: "rgba(0,0,0,0.04)",
									cursor: link ? "pointer" : "default",
									userSelect: "none"
								}}
								title={link ? "Abrir localização" : "Sem link de localização"}
							>
								<RoomIcon color="primary" />
							</div>
						)}
					</div>

					{description && (
						<div style={{ display: "flex", flexWrap: "wrap" }}>
							<Typography
								style={{
									marginTop: "12px",
									marginLeft: "15px",
									marginRight: "15px",
									float: "left"
								}}
								variant="subtitle1"
								color="primary"
								gutterBottom
							>
								<div dangerouslySetInnerHTML={{ __html: description.replace('\\n', '<br />') }}></div>
							</Typography>
						</div>
					)}

					<div style={{ display: "block", content: "", clear: "both" }}></div>

					<div>
						<Divider />
						<Button
							fullWidth
							color="primary"
							onClick={handleLocation}
							disabled={!link}
						>
							Visualizar
						</Button>
					</div>
				</div>
			</div>
		</>
	);

};

export default LocationPreview;
